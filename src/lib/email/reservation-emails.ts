import { resolveAdminNotificationRecipients } from "@/lib/email/admin-notification-recipients";
import { logEmailHandlerResult } from "@/lib/email/log-send-result";
import { sendEmail } from "@/lib/email/send-email";
import {
  getPaymentMethodLabel,
  type PaymentMethod,
} from "@/lib/reservations/payment-method";
import { findProfileEmailByUserIdAdmin as findProfileEmailByUserId } from "@/lib/repositories/profiles.repository";
import type { ReservationStatus } from "@/types/database";

export type ReservationCreatedEmailInput = {
  reservationId: string;
  userId: string;
  spotName: string;
  businessId: string | null;
  planName: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  totalAmountYen: number;
  status?: ReservationStatus;
  paymentMethod?: PaymentMethod;
};

export type ReservationCreatedEmailContext = {
  reservationId: string;
  customerEmail: string;
  spotName: string;
  planName: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  totalAmountYen: number;
  status: ReservationStatus;
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;
};

export function formatReservationTime(time: string): string {
  return time.slice(0, 5);
}

export function formatReservationStatusLabel(status: ReservationStatus): string {
  switch (status) {
    case "pending":
      return "仮予約（決済待ち）";
    case "confirmed":
      return "確定";
    case "cancelled":
      return "キャンセル";
    case "expired":
      return "期限切れ";
    default:
      return status;
  }
}

/** @deprecated getPaymentMethodLabel を直接使用 */
export function formatPaymentMethodLabel(
  status: ReservationStatus,
  paymentMethod: PaymentMethod = "online",
): string {
  if (paymentMethod === "cash_at_venue") {
    return getPaymentMethodLabel("cash_at_venue");
  }
  if (status === "pending") {
    return "オンライン決済（決済待ち）";
  }
  return getPaymentMethodLabel("online");
}

function buildCustomerClosingLines(context: ReservationCreatedEmailContext): string[] {
  if (context.paymentMethod === "cash_at_venue") {
    return [
      "当日、受付にて現金でお支払いください。",
      "ご不明点があれば釣り場までお問い合わせください。",
    ];
  }

  return [
    "カード決済が完了すると予約が確定します（30分以内）。",
    "ご不明点があれば釣り場までお問い合わせください。",
  ];
}

function formatAmountYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

function buildReservationDetailsLines(context: ReservationCreatedEmailContext): string[] {
  const timeRange = `${formatReservationTime(context.startTime)}〜${formatReservationTime(context.endTime)}`;

  return [
    `予約番号: ${context.reservationId}`,
    `釣り場: ${context.spotName}`,
    `プラン: ${context.planName}`,
    `利用日: ${context.reservationDate}`,
    `時間: ${timeRange}`,
    `人数: ${context.guestCount}名`,
    `合計金額: ${formatAmountYen(context.totalAmountYen)}`,
    `支払い方法: ${context.paymentMethodLabel}`,
    `ステータス: ${formatReservationStatusLabel(context.status)}`,
  ];
}

export function buildCustomerReservationCreatedEmail(context: ReservationCreatedEmailContext): {
  subject: string;
  text: string;
  html: string;
} {
  const lines = buildReservationDetailsLines(context);
  const closing = buildCustomerClosingLines(context);
  const subjectPrefix =
    context.paymentMethod === "cash_at_venue" ? "【予約確定】" : "【予約受付】";

  const text = ["ご予約を受け付けました。", "", ...lines, "", ...closing].join("\n");

  const html = [
    "<p>ご予約を受け付けました。</p>",
    "<ul>",
    ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
    ...closing.map((line) => `<p>${escapeHtml(line)}</p>`),
  ].join("\n");

  return {
    subject: `${subjectPrefix}${context.spotName} ${context.reservationDate}`,
    text,
    html,
  };
}

export function buildAdminReservationCreatedEmail(context: ReservationCreatedEmailContext): {
  subject: string;
  text: string;
  html: string;
} {
  const lines = [
    ...buildReservationDetailsLines(context),
    `予約者メール: ${context.customerEmail}`,
  ];

  const text = ["新しい予約が作成されました。", "", ...lines].join("\n");

  const html = [
    "<p>新しい予約が作成されました。</p>",
    "<ul>",
    ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
  ].join("\n");

  return {
    subject: `【予約通知】${context.spotName} ${context.reservationDate}`,
    text,
    html,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function logSendResult(
  label: string,
  result: Awaited<ReturnType<typeof sendEmail>>,
  context: { to: string | string[]; subject: string },
): Promise<void> {
  logEmailHandlerResult("sendReservationCreatedEmails", label, result, context);
}

/**
 * 予約作成成功後に予約者・管理者へ通知メールを送る。
 * 失敗しても throw せず、予約処理には影響しない。
 */
export async function sendReservationCreatedEmails(
  input: ReservationCreatedEmailInput,
): Promise<void> {
  try {
    const customerEmail = await findProfileEmailByUserId(input.userId);
    if (!customerEmail) {
      console.warn(
        "[sendReservationCreatedEmails] customer email not found for user:",
        input.userId,
      );
    }

    const status = input.status ?? "pending";
    const paymentMethod = input.paymentMethod ?? "online";
    const context: ReservationCreatedEmailContext = {
      reservationId: input.reservationId,
      customerEmail: customerEmail ?? "",
      spotName: input.spotName,
      planName: input.planName,
      reservationDate: input.reservationDate,
      startTime: input.startTime,
      endTime: input.endTime,
      guestCount: input.guestCount,
      totalAmountYen: input.totalAmountYen,
      status,
      paymentMethod,
      paymentMethodLabel: formatPaymentMethodLabel(status, paymentMethod),
    };

    if (customerEmail) {
      const customerEmailContent = buildCustomerReservationCreatedEmail(context);
      const customerResult = await sendEmail({
        to: customerEmail,
        subject: customerEmailContent.subject,
        text: customerEmailContent.text,
        html: customerEmailContent.html,
      });
      await logSendResult("customer email", customerResult, {
        to: customerEmail,
        subject: customerEmailContent.subject,
      });
    }

    const adminRecipients = await resolveAdminNotificationRecipients(input.businessId);
    if (adminRecipients.length === 0) {
      console.warn(
        "[sendReservationCreatedEmails] no admin notification recipients for business:",
        input.businessId,
      );
      return;
    }

    const adminEmailContent = buildAdminReservationCreatedEmail(context);
    const adminResult = await sendEmail({
      to: adminRecipients,
      subject: adminEmailContent.subject,
      text: adminEmailContent.text,
      html: adminEmailContent.html,
    });
    await logSendResult("admin notification", adminResult, {
      to: adminRecipients,
      subject: adminEmailContent.subject,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[sendReservationCreatedEmails]", message);
  }
}

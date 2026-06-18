import { resolveAdminNotificationRecipients } from "@/lib/email/admin-notification-recipients";
import { logEmailHandlerResult } from "@/lib/email/log-send-result";
import { formatReservationTime } from "@/lib/email/reservation-emails";
import { sendEmail } from "@/lib/email/send-email";
import { findProfileEmailByUserIdAdmin as findProfileEmailByUserId } from "@/lib/repositories/profiles.repository";

export type PaymentConfirmedEmailInput = {
  reservationId: string;
  customerUserId: string;
  spotName: string;
  businessId: string | null;
  planName: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  totalAmountYen: number;
};

export type PaymentConfirmedEmailContext = PaymentConfirmedEmailInput & {
  customerEmail: string;
};

function formatAmountYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

function buildPaymentConfirmationDetailsLines(context: PaymentConfirmedEmailContext): string[] {
  const timeRange = `${formatReservationTime(context.startTime)}〜${formatReservationTime(context.endTime)}`;

  return [
    `予約番号: ${context.reservationId}`,
    `釣り場: ${context.spotName}`,
    `プラン: ${context.planName}`,
    `利用日: ${context.reservationDate}`,
    `時間: ${timeRange}`,
    `人数: ${context.guestCount}名`,
    `合計金額: ${formatAmountYen(context.totalAmountYen)}`,
    `支払い方法: オンライン決済（Stripe）`,
    `ステータス: 確定`,
  ];
}

export function buildCustomerPaymentConfirmedEmail(context: PaymentConfirmedEmailContext): {
  subject: string;
  text: string;
  html: string;
} {
  const lines = buildPaymentConfirmationDetailsLines(context);
  const text = [
    "決済が完了し、ご予約が確定しました。",
    "",
    ...lines,
    "",
    "当日お会いできることを楽しみにしております。",
    "ご不明点があれば釣り場までお問い合わせください。",
  ].join("\n");

  const html = [
    "<p>決済が完了し、ご予約が確定しました。</p>",
    "<ul>",
    ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
    "<p>当日お会いできることを楽しみにしております。</p>",
    "<p>ご不明点があれば釣り場までお問い合わせください。</p>",
  ].join("\n");

  return {
    subject: `【予約確定】決済が完了しました - ${context.spotName}`,
    text,
    html,
  };
}

export function buildAdminPaymentConfirmedEmail(context: PaymentConfirmedEmailContext): {
  subject: string;
  text: string;
  html: string;
} {
  const lines = [
    ...buildPaymentConfirmationDetailsLines(context),
    `予約者メール: ${context.customerEmail}`,
  ];
  const text = ["予約が確定しました（決済完了）。", "", ...lines].join("\n");

  const html = [
    "<p>予約が確定しました（決済完了）。</p>",
    "<ul>",
    ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
  ].join("\n");

  return {
    subject: `【予約確定通知】${context.spotName} ${context.reservationDate}`,
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
  logEmailHandlerResult("sendPaymentConfirmedEmails", label, result, context);
}

/**
 * オンライン決済（Stripe webhook）完了後に予約者・管理者へ通知メールを送る。
 * cash_at_venue では呼ばない（現金精算完了メールは送らない）。
 * 失敗しても throw せず、Webhook / 決済処理には影響しない。
 */
export async function sendPaymentConfirmedEmails(
  input: PaymentConfirmedEmailInput,
): Promise<void> {
  try {
    const customerEmail = await findProfileEmailByUserId(input.customerUserId);
    if (!customerEmail) {
      console.warn(
        "[sendPaymentConfirmedEmails] customer email not found for user:",
        input.customerUserId,
      );
    }

    const context: PaymentConfirmedEmailContext = {
      ...input,
      customerEmail: customerEmail ?? "",
    };

    if (customerEmail) {
      const customerEmailContent = buildCustomerPaymentConfirmedEmail(context);
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
        "[sendPaymentConfirmedEmails] no admin notification recipients for business:",
        input.businessId,
      );
      return;
    }

    const adminEmailContent = buildAdminPaymentConfirmedEmail(context);
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
    console.warn("[sendPaymentConfirmedEmails]", message);
  }
}

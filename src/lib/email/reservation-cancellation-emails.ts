import { resolveAdminNotificationRecipients } from "@/lib/email/admin-notification-recipients";
import { formatReservationTime } from "@/lib/email/reservation-emails";
import { sendEmail } from "@/lib/email/send-email";
import { findProfileEmailByUserIdAdmin as findProfileEmailByUserId } from "@/lib/repositories/profiles.repository";

export type CancelledBy = "customer" | "admin" | "business_admin";

export type ReservationCancelledEmailInput = {
  reservationId: string;
  customerUserId: string;
  spotName: string;
  businessId: string | null;
  planName: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  cancelledBy: CancelledBy;
};

export type ReservationCancelledEmailContext = ReservationCancelledEmailInput & {
  customerEmail: string;
  cancelledByLabel: string;
};

export function formatCancelledByLabel(cancelledBy: CancelledBy): string {
  switch (cancelledBy) {
    case "customer":
      return "予約者本人";
    case "admin":
      return "全体管理者";
    case "business_admin":
      return "担当事業管理者";
    default:
      return cancelledBy;
  }
}

function buildCancellationDetailsLines(context: ReservationCancelledEmailContext): string[] {
  const timeRange = `${formatReservationTime(context.startTime)}〜${formatReservationTime(context.endTime)}`;

  return [
    `予約番号: ${context.reservationId}`,
    `釣り場: ${context.spotName}`,
    `プラン: ${context.planName}`,
    `利用日: ${context.reservationDate}`,
    `時間: ${timeRange}`,
    `人数: ${context.guestCount}名`,
    `キャンセル実行者: ${context.cancelledByLabel}`,
  ];
}

function getCustomerCancellationIntro(cancelledBy: CancelledBy): string {
  switch (cancelledBy) {
    case "customer":
      return "ご予約をキャンセルしました。";
    case "admin":
      return "管理者によりご予約がキャンセルされました。";
    case "business_admin":
      return "担当管理者によりご予約がキャンセルされました。";
    default:
      return "ご予約がキャンセルされました。";
  }
}

export function buildCustomerReservationCancelledEmail(
  context: ReservationCancelledEmailContext,
): {
  subject: string;
  text: string;
  html: string;
} {
  const intro = getCustomerCancellationIntro(context.cancelledBy);
  const lines = buildCancellationDetailsLines(context);
  const text = [intro, "", ...lines, "", "ご不明点があれば釣り場までお問い合わせください。"].join(
    "\n",
  );

  const html = [
    `<p>${escapeHtml(intro)}</p>`,
    "<ul>",
    ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
    "<p>ご不明点があれば釣り場までお問い合わせください。</p>",
  ].join("\n");

  return {
    subject: `【キャンセル完了】${context.spotName} ${context.reservationDate}`,
    text,
    html,
  };
}

export function buildAdminReservationCancelledEmail(
  context: ReservationCancelledEmailContext,
): {
  subject: string;
  text: string;
  html: string;
} {
  const lines = [
    ...buildCancellationDetailsLines(context),
    `予約者メール: ${context.customerEmail}`,
  ];
  const text = ["予約がキャンセルされました。", "", ...lines].join("\n");

  const html = [
    "<p>予約がキャンセルされました。</p>",
    "<ul>",
    ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
  ].join("\n");

  return {
    subject: `【キャンセル通知】${context.spotName} ${context.reservationDate}`,
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
): Promise<void> {
  if (result.ok && result.skipped) {
    return;
  }
  if (!result.ok) {
    console.warn(`[sendReservationCancelledEmails] ${label} failed:`, result.error);
  }
}

/**
 * キャンセル成功後に予約者・管理者へ通知メールを送る。
 * 失敗しても throw せず、キャンセル処理には影響しない。
 */
export async function sendReservationCancelledEmails(
  input: ReservationCancelledEmailInput,
): Promise<void> {
  try {
    const customerEmail = await findProfileEmailByUserId(input.customerUserId);
    if (!customerEmail) {
      console.warn(
        "[sendReservationCancelledEmails] customer email not found for user:",
        input.customerUserId,
      );
    }

    const context: ReservationCancelledEmailContext = {
      ...input,
      customerEmail: customerEmail ?? "",
      cancelledByLabel: formatCancelledByLabel(input.cancelledBy),
    };

    if (customerEmail) {
      const customerEmailContent = buildCustomerReservationCancelledEmail(context);
      const customerResult = await sendEmail({
        to: customerEmail,
        subject: customerEmailContent.subject,
        text: customerEmailContent.text,
        html: customerEmailContent.html,
      });
      await logSendResult("customer email", customerResult);
    }

    const adminRecipients = await resolveAdminNotificationRecipients(input.businessId);
    if (adminRecipients.length === 0) {
      console.warn(
        "[sendReservationCancelledEmails] no admin notification recipients for business:",
        input.businessId,
      );
      return;
    }

    const adminEmailContent = buildAdminReservationCancelledEmail(context);
    const adminResult = await sendEmail({
      to: adminRecipients,
      subject: adminEmailContent.subject,
      text: adminEmailContent.text,
      html: adminEmailContent.html,
    });
    await logSendResult("admin notification", adminResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[sendReservationCancelledEmails]", message);
  }
}

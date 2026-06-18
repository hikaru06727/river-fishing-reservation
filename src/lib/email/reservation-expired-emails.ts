import { logEmailHandlerResult } from "@/lib/email/log-send-result";
import { formatReservationTime } from "@/lib/email/reservation-emails";
import { sendEmail } from "@/lib/email/send-email";
import { getPaymentMethodLabel } from "@/lib/reservations/payment-method";
import { findProfileEmailByUserIdAdmin as findProfileEmailByUserId } from "@/lib/repositories/profiles.repository";

export type ReservationExpiredEmailInput = {
  reservationId: string;
  customerUserId: string;
  spotName: string;
  planName: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
};

export type ReservationExpiredEmailContext = ReservationExpiredEmailInput & {
  customerEmail: string;
  paymentMethodLabel: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildExpiredDetailsLines(context: ReservationExpiredEmailContext): string[] {
  const timeRange = `${formatReservationTime(context.startTime)}〜${formatReservationTime(context.endTime)}`;

  return [
    `予約番号: ${context.reservationId}`,
    `釣り場: ${context.spotName}`,
    `プラン: ${context.planName}`,
    `利用日: ${context.reservationDate}`,
    `時間: ${timeRange}`,
    `人数: ${context.guestCount}名`,
    `支払い方法: ${context.paymentMethodLabel}`,
  ];
}

export function buildCustomerReservationExpiredEmail(
  context: ReservationExpiredEmailContext,
): {
  subject: string;
  text: string;
  html: string;
} {
  const intro = [
    "ご予約は決済が完了しなかったため、期限切れとなりました。",
    "予約枠は自動的に解放されています。",
    "再度ご利用を希望される場合は、お手数ですがもう一度予約をお願いいたします。",
  ].join("\n");

  const lines = buildExpiredDetailsLines(context);
  const text = [intro, "", ...lines, "", "ご不明点があれば釣り場までお問い合わせください。"].join(
    "\n",
  );

  const html = [
    "<p>ご予約は決済が完了しなかったため、期限切れとなりました。</p>",
    "<p>予約枠は自動的に解放されています。</p>",
    "<p>再度ご利用を希望される場合は、お手数ですがもう一度予約をお願いいたします。</p>",
    "<ul>",
    ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
    "<p>ご不明点があれば釣り場までお問い合わせください。</p>",
  ].join("\n");

  return {
    subject: "【予約期限切れのお知らせ】ご予約は完了していません",
    text,
    html,
  };
}

async function logSendResult(
  label: string,
  result: Awaited<ReturnType<typeof sendEmail>>,
  context: { to: string | string[]; subject: string },
): Promise<void> {
  logEmailHandlerResult("sendReservationExpiredEmails", label, result, context);
}

export type SendReservationExpiredEmailResult =
  | { sent: true; skipped: boolean }
  | { sent: false; reason: "no_customer_email" | "send_failed" };

/**
 * 期限切れ（expired）予約の予約者へ通知メールを送る。
 * 失敗しても throw せず、Cron 処理全体には影響しない。
 */
export async function sendReservationExpiredEmail(
  input: ReservationExpiredEmailInput,
): Promise<SendReservationExpiredEmailResult> {
  try {
    const customerEmail = await findProfileEmailByUserId(input.customerUserId);
    if (!customerEmail) {
      console.warn(
        "[sendReservationExpiredEmails] customer email not found for user:",
        input.customerUserId,
      );
      return { sent: false, reason: "no_customer_email" };
    }

    const context: ReservationExpiredEmailContext = {
      ...input,
      customerEmail,
      paymentMethodLabel: getPaymentMethodLabel("online"),
    };

    const emailContent = buildCustomerReservationExpiredEmail(context);
    const result = await sendEmail({
      to: customerEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    await logSendResult("customer email", result, {
      to: customerEmail,
      subject: emailContent.subject,
    });

    if (!result.ok) {
      return { sent: false, reason: "send_failed" };
    }

    return { sent: true, skipped: result.skipped ?? false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[sendReservationExpiredEmails]", message);
    return { sent: false, reason: "send_failed" };
  }
}

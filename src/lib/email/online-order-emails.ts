import { logEmailHandlerResult } from "@/lib/email/log-send-result";
import { sendEmail } from "@/lib/email/send-email";
import {
  formatPickupDateTimeJst,
  formatPickupDeadlineDateJst,
} from "@/lib/online-orders/pickup-schedule";
import type { OnlineOrderFulfillmentType } from "@/types/domain";

export type OnlineOrderEmailItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatAmountYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

function buildItemLines(items: OnlineOrderEmailItem[]): string[] {
  return items.map(
    (item) => `${item.productName} x${item.quantity}（${formatAmountYen(item.unitPrice * item.quantity)}）`,
  );
}

async function logSendResult(
  label: string,
  result: Awaited<ReturnType<typeof sendEmail>>,
  context: { to: string | string[]; subject: string },
): Promise<void> {
  logEmailHandlerResult("online-order-emails", label, result, context);
}

// ---------------------------------------------------------------------------
// 注文確認メール
// ---------------------------------------------------------------------------

export type OnlineOrderConfirmationEmailInput = {
  orderId: string;
  customerEmail: string;
  fulfillmentType: OnlineOrderFulfillmentType;
  items: OnlineOrderEmailItem[];
  totalAmount: number;
  confirmationCode: string | null;
  pickupDate: string | null;
  pickupDeadline: string | null;
};

export function buildOnlineOrderConfirmationEmail(input: OnlineOrderConfirmationEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const isPickup = input.fulfillmentType === "pickup";
  const itemLines = buildItemLines(input.items);

  const lines = [
    `注文番号: ${input.orderId.slice(0, 8)}`,
    ...itemLines,
    `合計金額（税込）: ${formatAmountYen(input.totalAmount)}`,
    `受け取り方法: ${isPickup ? "店舗受け取り" : "配送"}`,
  ];

  if (isPickup && input.pickupDate) {
    lines.push(`希望受け取り日時: ${formatPickupDateTimeJst(input.pickupDate)}`);
  }
  if (isPickup && input.pickupDeadline) {
    lines.push(
      `受け取り期限: ${formatPickupDeadlineDateJst(input.pickupDeadline)}まで。期限を過ぎると自動キャンセルされます。`,
    );
  }
  if (isPickup && input.confirmationCode) {
    lines.push(`受け取り確認コード: ${input.confirmationCode}`);
  }

  const intro = "ご注文ありがとうございます。以下の内容で承りました。";
  const text = [intro, "", ...lines].join("\n");

  const html = [
    `<p>${intro}</p>`,
    "<ul>",
    ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
  ];
  if (isPickup && input.confirmationCode) {
    html.push(
      `<p style="font-size:1.5em;font-weight:bold;">受け取り確認コード：${escapeHtml(input.confirmationCode)}</p>`,
    );
  }

  return {
    subject: isPickup ? "【ご注文確認】店舗受け取りのご案内" : "【ご注文確認】",
    text,
    html: html.join("\n"),
  };
}

export async function sendOnlineOrderConfirmationEmail(
  input: OnlineOrderConfirmationEmailInput,
): Promise<void> {
  try {
    const emailContent = buildOnlineOrderConfirmationEmail(input);
    const result = await sendEmail({
      to: input.customerEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
    await logSendResult("order confirmation", result, {
      to: input.customerEmail,
      subject: emailContent.subject,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[sendOnlineOrderConfirmationEmail]", message);
  }
}

// ---------------------------------------------------------------------------
// 準備完了メール（status='ready'）
// ---------------------------------------------------------------------------

export type OnlineOrderReadyEmailInput = {
  orderId: string;
  customerEmail: string;
  confirmationCode: string | null;
  pickupDeadline: string | null;
};

export function buildOnlineOrderReadyEmail(input: OnlineOrderReadyEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const lines = [`注文番号: ${input.orderId.slice(0, 8)}`];
  if (input.confirmationCode) {
    lines.push(`受け取り確認コード: ${input.confirmationCode}`);
  }
  if (input.pickupDeadline) {
    lines.push(
      `受け取り期限: ${formatPickupDeadlineDateJst(input.pickupDeadline)}まで。期限を過ぎると自動キャンセルされます。`,
    );
  }

  const intro = "ご注文の商品の準備が完了しました。店舗にてお受け取りください。";
  const text = [intro, "", ...lines].join("\n");
  const html = [
    `<p>${intro}</p>`,
    "<ul>",
    ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
  ].join("\n");

  return { subject: "【受け取り準備完了】ご注文の商品をご用意しました", text, html };
}

export async function sendOnlineOrderReadyEmail(input: OnlineOrderReadyEmailInput): Promise<void> {
  try {
    const emailContent = buildOnlineOrderReadyEmail(input);
    const result = await sendEmail({
      to: input.customerEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
    await logSendResult("pickup ready", result, {
      to: input.customerEmail,
      subject: emailContent.subject,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[sendOnlineOrderReadyEmail]", message);
  }
}

// ---------------------------------------------------------------------------
// 受け取り期限切れキャンセルメール
// ---------------------------------------------------------------------------

export type OnlineOrderPickupExpiredEmailInput = {
  orderId: string;
  customerEmail: string;
  pickupDate: string | null;
};

export function buildOnlineOrderPickupExpiredEmail(
  input: OnlineOrderPickupExpiredEmailInput,
): {
  subject: string;
  text: string;
  html: string;
} {
  const lines = [`注文番号: ${input.orderId.slice(0, 8)}`];
  if (input.pickupDate) {
    lines.push(`希望受け取り日時: ${formatPickupDateTimeJst(input.pickupDate)}`);
  }

  const intro = "受け取り期限が過ぎたため、ご注文は自動的にキャンセルされました。";
  const closing = "再度ご利用を希望される場合は、お手数ですがもう一度ご注文をお願いいたします。";
  const text = [intro, "", ...lines, "", closing].join("\n");
  const html = [
    `<p>${intro}</p>`,
    "<ul>",
    ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
    `<p>${closing}</p>`,
  ].join("\n");

  return { subject: "【ご注文キャンセルのお知らせ】受け取り期限が過ぎました", text, html };
}

export async function sendOnlineOrderPickupExpiredEmail(
  input: OnlineOrderPickupExpiredEmailInput,
): Promise<void> {
  try {
    const emailContent = buildOnlineOrderPickupExpiredEmail(input);
    const result = await sendEmail({
      to: input.customerEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
    await logSendResult("pickup expired cancellation", result, {
      to: input.customerEmail,
      subject: emailContent.subject,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[sendOnlineOrderPickupExpiredEmail]", message);
  }
}

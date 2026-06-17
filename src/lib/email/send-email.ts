import { getResendClient } from "@/lib/email/client";
import {
  getEmailSkipReason,
  getMailFrom,
  shouldLogEmailSkip,
} from "@/lib/email/config";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
};

export type SendEmailSuccess = {
  ok: true;
  skipped?: boolean;
  id?: string;
};

export type SendEmailFailure = {
  ok: false;
  error: string;
};

export type SendEmailResult = SendEmailSuccess | SendEmailFailure;

function logEmailSkip(reason: NonNullable<ReturnType<typeof getEmailSkipReason>>): void {
  if (!shouldLogEmailSkip(reason)) {
    return;
  }

  const messages: Record<typeof reason, string> = {
    missing_api_key:
      "[sendEmail] RESEND_API_KEY is not set. Email was skipped.",
    missing_from: "[sendEmail] MAIL_FROM is not set. Email was skipped.",
    disabled: "[sendEmail] EMAILS_ENABLED is false. Email was skipped.",
  };

  console.warn(messages[reason]);
}

/**
 * Resend 経由でメール送信。
 * EMAILS_ENABLED=false または設定不足時は skip（ok: true, skipped: true）。
 * 送信失敗時も throw せず { ok: false, error } を返す。
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const skipReason = getEmailSkipReason();
  if (skipReason) {
    logEmailSkip(skipReason);
    return { ok: true, skipped: true };
  }

  const client = getResendClient();
  const from = getMailFrom();

  if (!client || !from) {
    console.warn("[sendEmail] Resend client or MAIL_FROM unavailable. Email was skipped.");
    return { ok: true, skipped: true };
  }

  if (!input.text && !input.html) {
    return { ok: false, error: "Either text or html body is required." };
  }

  try {
    const base = {
      from,
      to: input.to,
      subject: input.subject,
    };

    const { data, error } = input.html
      ? await client.emails.send({
          ...base,
          html: input.html,
          ...(input.text ? { text: input.text } : {}),
        })
      : await client.emails.send({
          ...base,
          text: input.text!,
        });

    if (error) {
      console.error("[sendEmail] Resend API error:", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email send error";
    console.error("[sendEmail]", message);
    return { ok: false, error: message };
  }
}

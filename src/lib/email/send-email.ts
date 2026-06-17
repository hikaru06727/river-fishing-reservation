import { getResendClient } from "@/lib/email/client";
import {
  getEmailSkipMessage,
  getEmailSkipReason,
  getMailFrom,
  shouldLogEmailSkip,
  type EmailSkipReason,
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
  skipReason?: EmailSkipReason;
  id?: string;
};

export type SendEmailFailure = {
  ok: false;
  error: string;
};

export type SendEmailResult = SendEmailSuccess | SendEmailFailure;

function formatRecipients(to: string | string[]): string {
  const list = Array.isArray(to) ? to : [to];
  if (list.length === 1) {
    return list[0]!;
  }
  return `${list[0]} (+${list.length - 1} more)`;
}

function logEmailSkip(
  reason: EmailSkipReason,
  input: Pick<SendEmailInput, "to" | "subject">,
): void {
  if (!shouldLogEmailSkip()) {
    return;
  }

  console.warn(
    `[sendEmail] Skipped (${reason}) to=${formatRecipients(input.to)} subject="${input.subject}". ${getEmailSkipMessage(reason)} See docs/email-setup.md`,
  );
}

/**
 * トランザクションメール送信の共通入口（現在は Resend 実装）。
 * EMAILS_ENABLED=false または設定不足時は skip（ok: true, skipped: true）。
 * 送信失敗時も throw せず { ok: false, error } を返す。
 *
 * Resend SDK への依存は lib/email/client.ts に閉じ込め、
 * 将来 SES / SMTP 等へ差し替える場合はこの関数の内部実装のみ変更する。
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const skipReason = getEmailSkipReason();
  if (skipReason) {
    logEmailSkip(skipReason, input);
    return { ok: true, skipped: true, skipReason };
  }

  const client = getResendClient();
  const from = getMailFrom();

  if (!client || !from) {
    console.warn(
      `[sendEmail] Skipped (misconfigured) to=${formatRecipients(input.to)} subject="${input.subject}". Resend client or MAIL_FROM unavailable. See docs/email-setup.md`,
    );
    return { ok: true, skipped: true, skipReason: "missing_api_key" };
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
      console.error(
        `[sendEmail] Provider API error to=${formatRecipients(input.to)} subject="${input.subject}":`,
        error.message,
      );
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email send error";
    console.error(
      `[sendEmail] Unexpected error to=${formatRecipients(input.to)} subject="${input.subject}":`,
      message,
    );
    return { ok: false, error: message };
  }
}

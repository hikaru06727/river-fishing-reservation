import type { EmailSkipReason } from "@/lib/email/config";
import { getEmailSkipMessage } from "@/lib/email/config";
import type { SendEmailResult } from "@/lib/email/send-email";

function formatRecipients(to: string | string[]): string {
  const list = Array.isArray(to) ? to : [to];
  if (list.length === 1) {
    return list[0]!;
  }
  return `${list[0]} (+${list.length - 1} more)`;
}

/**
 * ドメインメールハンドラ（予約/決済/キャンセル）から sendEmail 結果をログ。
 * skip 時も原因が分かるよう warn を出す（予約処理自体は継続）。
 */
export function logEmailHandlerResult(
  handlerPrefix: string,
  label: string,
  result: SendEmailResult,
  context?: { to?: string | string[]; subject?: string },
): void {
  if (result.ok && result.skipped) {
    const reason = (result.skipReason ?? "disabled") as EmailSkipReason;
    const target =
      context?.to != null
        ? ` to=${formatRecipients(context.to)}`
        : "";
    const subject = context?.subject ? ` subject="${context.subject}"` : "";
    console.warn(
      `[${handlerPrefix}] ${label} skipped (${reason}).${target}${subject} ${getEmailSkipMessage(reason)} See docs/email-setup.md`,
    );
    return;
  }

  if (!result.ok) {
    console.warn(`[${handlerPrefix}] ${label} failed:`, result.error);
  }
}

import { Resend } from "resend";
import { getResendApiKey } from "@/lib/email/config";

/** Resend SDK シングルトン。将来 SES/SMTP 移行時は providers/ 配下に差し替え。 */
let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

/** テスト用: シングルトンをリセット */
export function resetResendClientForTests(): void {
  resendClient = null;
}

import { Resend } from "resend";
import { getResendApiKey } from "@/lib/email/config";

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

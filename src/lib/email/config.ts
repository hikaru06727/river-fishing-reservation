export type EmailSkipReason = "disabled" | "missing_api_key" | "missing_from";

export function isEmailsEnabled(): boolean {
  const value = process.env.EMAILS_ENABLED?.trim().toLowerCase();
  return value === "true" || value === "1";
}

export function getResendApiKey(): string | undefined {
  const key = process.env.RESEND_API_KEY?.trim();
  return key || undefined;
}

export function getMailFrom(): string | undefined {
  const from = process.env.MAIL_FROM?.trim();
  return from || undefined;
}

export function getAdminNotificationEmail(): string | undefined {
  const email = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  return email || undefined;
}

/** 送信を skip する理由。null なら送信可能 */
export function getEmailSkipReason(): EmailSkipReason | null {
  if (!isEmailsEnabled()) {
    return "disabled";
  }
  if (!getResendApiKey()) {
    return "missing_api_key";
  }
  if (!getMailFrom()) {
    return "missing_from";
  }
  return null;
}

/** skip 理由に対する設定ヒント（ログ・API レスポンス用） */
export function getEmailSkipMessage(reason: EmailSkipReason): string {
  switch (reason) {
    case "disabled":
      return 'Set EMAILS_ENABLED=true in .env.local to enable transactional emails.';
    case "missing_api_key":
      return "Set RESEND_API_KEY in .env.local (Resend dashboard → API Keys).";
    case "missing_from":
      return 'Set MAIL_FROM in .env.local (e.g. MAIL_FROM="予約 <noreply@yourdomain.com>"). The domain must be verified in Resend.';
  }
}

export type EmailConfigStatus = {
  enabled: boolean;
  ready: boolean;
  skipReason: EmailSkipReason | null;
  hasApiKey: boolean;
  hasMailFrom: boolean;
  hasAdminFallback: boolean;
};

/** 現在のメール設定状態（Resend 送信可否の確認用） */
export function getEmailConfigStatus(): EmailConfigStatus {
  const skipReason = getEmailSkipReason();
  return {
    enabled: isEmailsEnabled(),
    ready: skipReason === null,
    skipReason,
    hasApiKey: Boolean(getResendApiKey()),
    hasMailFrom: Boolean(getMailFrom()),
    hasAdminFallback: Boolean(getAdminNotificationEmail()),
  };
}

export function shouldLogEmailSkip(): boolean {
  return true;
}

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

export function shouldLogEmailSkip(reason: EmailSkipReason): boolean {
  if (reason === "disabled") {
    return false;
  }
  return true;
}

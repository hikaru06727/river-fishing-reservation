import { getAdminNotificationEmail } from "@/lib/email/config";
import { findBusinessAdminEmailsByBusinessId } from "@/lib/repositories/profiles.repository";

function dedupeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const email of emails) {
    const normalized = email.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(email.trim());
  }

  return result;
}

export async function getBusinessAdminEmailsForBusiness(
  businessId: string,
): Promise<string[]> {
  const emails = await findBusinessAdminEmailsByBusinessId(businessId);
  return dedupeEmails(emails);
}

/**
 * 担当事業の business_admin に通知。担当者がいなければ ADMIN_NOTIFICATION_EMAIL。
 * 全体 admin 全員への一斉送信は行わない（既存 RLS / スコープ設計に合わせる）。
 */
export async function resolveAdminNotificationRecipients(
  businessId: string | null | undefined,
): Promise<string[]> {
  if (businessId) {
    const businessAdminEmails = await getBusinessAdminEmailsForBusiness(businessId);
    if (businessAdminEmails.length > 0) {
      return businessAdminEmails;
    }
  }

  const fallback = getAdminNotificationEmail();
  return fallback ? [fallback] : [];
}

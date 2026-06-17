import { getAdminNotificationEmail } from "@/lib/email/config";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const admin = createAdminClient();

  const { data: assignments, error: assignmentError } = await admin
    .from("business_admin_assignments")
    .select("user_id")
    .eq("business_id", businessId);

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  const userIds = (assignments ?? []).map((row) => row.user_id);
  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("email")
    .in("id", userIds)
    .eq("role", "business_admin");

  if (profileError) {
    throw new Error(profileError.message);
  }

  return dedupeEmails(
    (profiles ?? [])
      .map((profile) => profile.email)
      .filter((email): email is string => Boolean(email?.trim())),
  );
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

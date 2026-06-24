import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import {
  insertStaffMember,
  findStaffMembersByBusinessId,
  findStaffMemberById,
  findStaffMemberByIdAdmin,
  disableStaffMember,
  enableStaffMember,
  acceptStaffInvitation,
} from "@/lib/repositories/staff-members.repository";
import { sendStaffInvitationEmail } from "@/lib/email/staff-invitation-email";
import { findBusinessNamesByIds } from "@/lib/repositories/businesses.repository";
import type { StaffMemberRow } from "@/types/database";
import type { Profile } from "@/types/database";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** スタッフ一覧取得 */
export async function getStaffMembers(
  profile: Pick<Profile, "id" | "role">,
  businessId: string,
): Promise<ServiceResult<StaffMemberRow[]>> {
  if (!hasPermission(profile.role, "STAFF_MANAGE")) {
    return { ok: false, error: "スタッフ管理の権限がありません。" };
  }

  try {
    const members = await findStaffMembersByBusinessId(businessId);
    return { ok: true, data: members };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "スタッフ一覧の取得に失敗しました。",
    };
  }
}

/** スタッフを招待 */
export async function inviteStaffMember(
  profile: Pick<Profile, "id" | "role" | "full_name">,
  params: {
    businessId: string;
    email: string;
    name?: string | null;
  },
): Promise<ServiceResult<StaffMemberRow>> {
  if (!hasPermission(profile.role, "STAFF_MANAGE")) {
    return { ok: false, error: "スタッフ招待の権限がありません。" };
  }

  let member: StaffMemberRow;
  try {
    member = await insertStaffMember({
      business_id: params.businessId,
      email: params.email,
      name: params.name ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "スタッフの招待に失敗しました。";
    if (message.includes("unique") || message.includes("duplicate")) {
      return { ok: false, error: "このメールアドレスはすでに招待済みです。" };
    }
    return { ok: false, error: message };
  }

  try {
    const businessNames = await findBusinessNamesByIds([params.businessId]);
    const businessName = businessNames[0] ?? "不明な事業";

    await sendStaffInvitationEmail({
      staffMemberId: member.id,
      staffEmail: member.email,
      staffName: member.name,
      businessName,
      invitedByName: profile.full_name,
    });
  } catch (err) {
    console.error("[inviteStaffMember] email send failed:", err);
  }

  return { ok: true, data: member };
}

/** スタッフを無効化（profiles.role を 'user' に戻してログイン不可にする） */
export async function disableStaff(
  profile: Pick<Profile, "id" | "role">,
  staffMemberId: string,
): Promise<ServiceResult<void>> {
  if (!hasPermission(profile.role, "STAFF_MANAGE")) {
    return { ok: false, error: "スタッフ管理の権限がありません。" };
  }

  let member: import("@/types/database").StaffMemberRow | null;
  try {
    member = await findStaffMemberByIdAdmin(staffMemberId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "スタッフ情報の取得に失敗しました。",
    };
  }

  if (!member) {
    return { ok: false, error: "スタッフが見つかりません。" };
  }

  try {
    await disableStaffMember(staffMemberId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "スタッフの無効化に失敗しました。",
    };
  }

  if (member.user_id) {
    try {
      const admin = createAdminClient();
      const { error } = await admin
        .from("profiles")
        .update({ role: "user" })
        .eq("id", member.user_id);
      if (error) throw new Error(error.message);
    } catch (err) {
      console.error("[disableStaff] profile role downgrade failed:", err);
    }
  }

  return { ok: true, data: undefined };
}

/** スタッフを再有効化（profiles.role を 'staff' に戻してアクセスを回復） */
export async function enableStaff(
  profile: Pick<Profile, "id" | "role">,
  staffMemberId: string,
): Promise<ServiceResult<void>> {
  if (!hasPermission(profile.role, "STAFF_MANAGE")) {
    return { ok: false, error: "スタッフ管理の権限がありません。" };
  }

  let member: import("@/types/database").StaffMemberRow | null;
  try {
    member = await findStaffMemberByIdAdmin(staffMemberId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "スタッフ情報の取得に失敗しました。",
    };
  }

  if (!member) {
    return { ok: false, error: "スタッフが見つかりません。" };
  }
  if (!member.user_id) {
    return { ok: false, error: "招待未受諾のスタッフは再有効化できません。" };
  }

  try {
    await enableStaffMember(staffMemberId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "スタッフの再有効化に失敗しました。",
    };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ role: "staff" })
      .eq("id", member.user_id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("[enableStaff] profile role restore failed:", err);
  }

  return { ok: true, data: undefined };
}

/** 招待受諾処理（staff join ページから呼ぶ） */
export async function acceptInvitation(
  staffMemberId: string,
  userId: string,
  userEmail: string,
): Promise<ServiceResult<void>> {
  const member = await findStaffMemberById(staffMemberId);

  if (!member) {
    return { ok: false, error: "招待が見つかりません。" };
  }
  if (member.status !== "invited") {
    return { ok: false, error: "この招待はすでに使用済みか無効です。" };
  }
  if (member.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { ok: false, error: "招待メールアドレスとアカウントのメールアドレスが一致しません。" };
  }

  try {
    await acceptStaffInvitation(staffMemberId, userId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "招待の受諾に失敗しました。",
    };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ role: "staff" })
      .eq("id", userId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    console.error("[acceptInvitation] role update failed:", err);
    return { ok: false, error: "ロールの更新に失敗しました。管理者に連絡してください。" };
  }

  return { ok: true, data: undefined };
}

/** 現在ログイン中のユーザーが staff かどうかを確認し、所属 staff_member レコードを返す */
export async function getCurrentStaffMember(): Promise<StaffMemberRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("staff_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[getCurrentStaffMember]", error.message);
    return null;
  }

  return data;
}

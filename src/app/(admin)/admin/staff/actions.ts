"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { inviteStaffMember, disableStaff, enableStaff } from "@/lib/services/staff-member.service";
import { hasPermission } from "@/lib/permissions";

export type StaffActionState = {
  error?: string;
  success?: string;
};

export async function inviteStaffAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/staff");

  if (!hasPermission(session.profile.role, "STAFF_MANAGE")) {
    return { error: "スタッフ管理の権限がありません。" };
  }

  const businessId = formData.get("businessId") as string | null;
  const email = (formData.get("email") as string | null)?.trim();
  const name = (formData.get("name") as string | null)?.trim() || null;

  if (!businessId || !email) {
    return { error: "事業とメールアドレスは必須です。" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "有効なメールアドレスを入力してください。" };
  }

  const result = await inviteStaffMember(session.profile, {
    businessId,
    email,
    name,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  return { success: `${email} に招待メールを送信しました。` };
}

export async function disableStaffAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/staff");

  const staffMemberId = formData.get("staffMemberId") as string | null;
  if (!staffMemberId) return { error: "対象が指定されていません。" };

  const result = await disableStaff(session.profile, staffMemberId);
  if (!result.ok) return { error: result.error };

  return { success: "スタッフを無効化しました。" };
}

export async function enableStaffAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/staff");

  const staffMemberId = formData.get("staffMemberId") as string | null;
  if (!staffMemberId) return { error: "対象が指定されていません。" };

  const result = await enableStaff(session.profile, staffMemberId);
  if (!result.ok) return { error: result.error };

  return { success: "スタッフを再有効化しました。" };
}

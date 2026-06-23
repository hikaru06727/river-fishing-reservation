"use server";

import { getUser } from "@/lib/auth/get-user";
import { acceptInvitation } from "@/lib/services/staff-member.service";
import { findProfileByUserId } from "@/lib/repositories/profiles.repository";

export type JoinActionState = {
  error?: string;
  success?: boolean;
};

export async function acceptStaffInvitationAction(
  _prev: JoinActionState,
  formData: FormData,
): Promise<JoinActionState> {
  const staffMemberId = formData.get("staffMemberId") as string | null;
  if (!staffMemberId) return { error: "招待IDが指定されていません。" };

  const user = await getUser();
  if (!user) return { error: "ログインが必要です。" };

  const profile = await findProfileByUserId(user.id).catch(() => null);
  const userEmail = profile?.email ?? user.email ?? "";

  const result = await acceptInvitation(staffMemberId, user.id, userEmail);

  if (!result.ok) {
    return { error: result.error };
  }

  return { success: true };
}

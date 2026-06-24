import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffMemberRow } from "@/types/database";
import type { StaffStatus } from "@/types/domain";

export type InsertStaffMemberInput = {
  business_id: string;
  email: string;
  name?: string | null;
};

export type UpdateStaffMemberInput = {
  user_id?: string | null;
  name?: string | null;
  status?: StaffStatus;
  joined_at?: string | null;
};

/** 事業のスタッフ一覧（business_admin 権限下） */
export async function findStaffMembersByBusinessId(
  businessId: string,
): Promise<StaffMemberRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff_members")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

/** ID でスタッフレコードを取得 */
export async function findStaffMemberById(
  id: string,
): Promise<StaffMemberRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff_members")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** メールアドレスでスタッフレコードを取得（招待受諾時に使用） */
export async function findStaffMemberByEmail(
  email: string,
): Promise<StaffMemberRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff_members")
    .select("*")
    .eq("email", email)
    .eq("status", "invited")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** user_id でスタッフレコードを取得 */
export async function findStaffMemberByUserId(
  userId: string,
): Promise<StaffMemberRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff_members")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** スタッフが所属する事業 ID 一覧 */
export async function findAssignedBusinessIdsByStaffUserId(
  userId: string,
): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff_members")
    .select("business_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.business_id);
}

/** スタッフを招待（service_role を使用して profiles の制約を回避） */
export async function insertStaffMember(
  input: InsertStaffMemberInput,
): Promise<StaffMemberRow> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("staff_members")
    .insert({
      business_id: input.business_id,
      email: input.email,
      name: input.name ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** スタッフ情報を更新 */
export async function updateStaffMember(
  id: string,
  input: UpdateStaffMemberInput,
): Promise<StaffMemberRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff_members")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** 招待受諾: user_id リンク + status を active に更新（service_role を使用） */
export async function acceptStaffInvitation(
  staffMemberId: string,
  userId: string,
): Promise<StaffMemberRow> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("staff_members")
    .update({
      user_id: userId,
      status: "active",
      joined_at: new Date().toISOString(),
    })
    .eq("id", staffMemberId)
    .eq("status", "invited")
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** service_role でスタッフレコードを取得（disable/enable フローで権限問わず読む） */
export async function findStaffMemberByIdAdmin(
  id: string,
): Promise<StaffMemberRow | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("staff_members")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** スタッフを無効化（service_role 使用: business_admin の RLS を回避） */
export async function disableStaffMember(id: string): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("staff_members")
    .update({ status: "disabled" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

/** スタッフを再有効化（service_role 使用: business_admin の RLS を回避） */
export async function enableStaffMember(id: string): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("staff_members")
    .update({ status: "active" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database, Profile, UserRole } from "@/types/database";

export type ProfileEmailAndRole = {
  email: string;
  role: UserRole;
};

/** middleware 等: 渡された Supabase client で role を取得（Cookie コンテキスト維持） */
export async function findProfileRoleByUserIdWithClient(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.role as UserRole | undefined) ?? null;
}

/** ナビ表示用: email + role（RLS 下・anon client） */
export async function findProfileEmailAndRoleByUserId(
  userId: string,
): Promise<ProfileEmailAndRole | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return { email: data.email, role: data.role as UserRole };
}

/** ログイン中ユーザーの profile 全文（RLS 下） */
export async function findProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** 管理権限チェック用 profile（RLS 下・maybeSingle） */
export async function findProfileByUserIdMaybe(userId: string): Promise<Profile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** メール送信用: ユーザーの email（service_role） */
export async function findProfileEmailByUserIdAdmin(userId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.email ?? null;
}

/** 通知先: 担当事業の business_admin メール一覧（service_role） */
export async function findBusinessAdminEmailsByBusinessId(
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

  return (profiles ?? [])
    .map((profile) => profile.email)
    .filter((email): email is string => Boolean(email?.trim()));
}

/** @deprecated findProfileEmailByUserIdAdmin を使用 */
export const findProfileEmailByUserId = findProfileEmailByUserIdAdmin;

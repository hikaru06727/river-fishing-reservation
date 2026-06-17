import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/types/database";

/** middleware / server 共通: profiles.role を取得（RLS: 本人 SELECT 可） */
export async function fetchProfileRoleByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[fetchProfileRoleByUserId]", error.message);
    return null;
  }

  return (data?.role as UserRole | undefined) ?? null;
}

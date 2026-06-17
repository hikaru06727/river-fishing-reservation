import type { SupabaseClient } from "@supabase/supabase-js";
import { findProfileRoleByUserIdWithClient } from "@/lib/repositories/profiles.repository";
import type { UserRole } from "@/types/database";

/** middleware / server 共通: profiles.role を取得（RLS: 本人 SELECT 可） */
export async function fetchProfileRoleByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserRole | null> {
  try {
    return await findProfileRoleByUserIdWithClient(
      supabase as Parameters<typeof findProfileRoleByUserIdWithClient>[0],
      userId,
    );
  } catch (error) {
    console.error("[fetchProfileRoleByUserId]", error instanceof Error ? error.message : error);
    return null;
  }
}

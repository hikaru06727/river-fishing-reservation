import type { User } from "@supabase/supabase-js";

/** コード側ロール判定（Supabase RLS には依存しない） */
export function getRoleFromUser(user: User | null | undefined): string | undefined {
  if (!user) {
    return undefined;
  }

  return user.user_metadata?.role as string | undefined;
}

export function isAdminUser(user: User | null | undefined): boolean {
  return getRoleFromUser(user) === "admin";
}

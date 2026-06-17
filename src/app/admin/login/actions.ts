"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isManagementRole } from "@/lib/auth/role";

function adminLoginRedirectPath(message: string, next?: string): string {
  const params = new URLSearchParams({ error: message });
  if (next) {
    params.set("next", next);
  }
  return `/admin/login?${params.toString()}`;
}

export async function adminLogin(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "/admin/reservations";

  if (!email || !password) {
    redirect(adminLoginRedirectPath("メールアドレスとパスワードを入力してください", next));
  }

  const supabase = await createClient();

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (signInError || !signInData.user) {
    redirect(
      adminLoginRedirectPath(
        signInError?.message ?? "ログインに失敗しました",
        next,
      ),
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", signInData.user.id)
    .maybeSingle();

  if (profileError || !isManagementRole(profile?.role)) {
    await supabase.auth.signOut();
    redirect(
      adminLoginRedirectPath(
        "管理者権限がありません。一般ユーザーの方は通常のログインをご利用ください。",
        next,
      ),
    );
  }

  const safeNext = next.startsWith("/admin") ? next : "/admin/reservations";
  redirect(safeNext);
}

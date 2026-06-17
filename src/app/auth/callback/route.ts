import { NextResponse } from "next/server";
import { fetchProfileRoleByUserId } from "@/lib/auth/fetch-profile-role";
import { isManagementRole } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/my/reservations";

  if (code) {
    const supabase = await createClient();
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData.user) {
      const profileRole = await fetchProfileRoleByUserId(supabase, sessionData.user.id);

      if (isManagementRole(profileRole)) {
        await supabase.auth.signOut();
        const params = new URLSearchParams({
          error:
            "管理者アカウントは Magic Link ではログインできません。管理者ログインをご利用ください。",
        });
        return NextResponse.redirect(`${origin}/admin/login?${params.toString()}`);
      }

      const safeNext = next.startsWith("/") ? next : "/my/reservations";
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}

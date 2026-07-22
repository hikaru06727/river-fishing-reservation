import { NextResponse } from "next/server";
import { fetchProfileRoleByUserId } from "@/lib/auth/fetch-profile-role";
import { isManagementRole } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";

/**
 * exchangeCodeForSession の失敗理由を利用者に伝わる形に分類する。
 * Supabase の AuthApiError.code は SDK が返す既知のエラーコード一覧
 * （node_modules/@supabase/auth-js/dist/module/lib/error-codes.d.ts）に基づく。
 * flow_state_not_found は「同じリンクを2回開いた（既に確認/使用済み）」、
 * bad_code_verifier は「発行時と異なるブラウザ/端末でリンクを開いた」ケースで
 * 典型的に発生する。両者は Supabase 側で厳密に区別されないため、既知コードに
 * 基づく最善の推定として提示する。
 */
function classifyCallbackError(code: string | undefined): {
  reason: "expired" | "already_used" | "browser_mismatch" | "unknown";
  message: string;
} {
  switch (code) {
    case "otp_expired":
    case "flow_state_expired":
      return {
        reason: "expired",
        message: "リンクの有効期限が切れています。お手数ですが再度お試しください。",
      };
    case "flow_state_not_found":
      return {
        reason: "already_used",
        message: "このリンクは既に使用されています（既に確認済みの可能性があります）。",
      };
    case "bad_code_verifier":
      return {
        reason: "browser_mismatch",
        message:
          "リンクをメール送信時と異なるブラウザ・アプリで開いた可能性があります。メールを受信した端末・ブラウザで開き直してください。",
      };
    default:
      return {
        reason: "unknown",
        message: "認証処理中に不明なエラーが発生しました。",
      };
  }
}

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
          error: "管理者アカウントはこちらのログインをご利用できません。管理者ログインをご利用ください。",
        });
        return NextResponse.redirect(`${origin}/login?${params.toString()}`);
      }

      const safeNext = next.startsWith("/") ? next : "/my/reservations";
      return NextResponse.redirect(`${origin}${safeNext}`);
    }

    const { reason, message } = classifyCallbackError(
      error && "code" in error ? (error.code as string | undefined) : undefined,
    );
    const params = new URLSearchParams({ error: message, reason });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  const params = new URLSearchParams({
    error: "認証リンクが正しくありません。",
    reason: "unknown",
  });
  return NextResponse.redirect(`${origin}/login?${params.toString()}`);
}

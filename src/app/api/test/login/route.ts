import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  getE2ETestLoginGateDebug,
  isE2ETestLoginEnabled,
  logE2ETestLoginGateDenied,
  logE2ETestLoginSecretRejected,
  validateE2ETestLoginSecret,
} from "@/lib/dev/e2e-test-login-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * E2E テスト専用: Magic Link のメール受信を経由せず、既存ユーザーのセッションを
 * 発行して Cookie にセットする。Playwright からのみ利用想定。
 *
 * - Vercel 上・NODE_ENV=production では常に 403
 * - E2E_TEST_LOGIN_ENABLED=true かつ E2E_TEST_LOGIN_SECRET 未設定時も 403
 * - x-e2e-test-secret ヘッダーが一致しない場合も 403
 */
export async function POST(request: Request) {
  const gateDebug = getE2ETestLoginGateDebug();

  if (!isE2ETestLoginEnabled()) {
    logE2ETestLoginGateDenied(gateDebug);
    return NextResponse.json(
      { error: "This endpoint is disabled on hosted environments or when not explicitly enabled" },
      { status: 403 },
    );
  }

  const secretValidation = validateE2ETestLoginSecret(request);
  if (!secretValidation.ok) {
    logE2ETestLoginSecretRejected(secretValidation);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !linkData.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkError?.message ?? "Failed to generate magic link (does the user exist?)" },
      { status: 400 },
    );
  }

  const anonClient = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: verifyData, error: verifyError } = await anonClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError || !verifyData.session) {
    return NextResponse.json(
      { error: verifyError?.message ?? "Failed to verify magic link token" },
      { status: 400 },
    );
  }

  const supabase = await createServerClient();
  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: verifyData.session.access_token,
    refresh_token: verifyData.session.refresh_token,
  });

  if (setSessionError) {
    return NextResponse.json({ error: setSessionError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: verifyData.session.user.id });
}

// 一度きりのセットアップスクリプト（環境ごとに1回実行する）。
// Phase 19D: 予約キャンセル時の自動返金（顧客自身のキャンセル操作）で
// refunded_by に使う、ログイン不可の system プレースホルダー profile を作成する。
//
// 実行方法（Node 20.6+、.env.local を読み込んで実行）:
//   node --env-file=.env.local scripts/setup-system-profile.mjs
//
// 冪等: 既に is_system = true の profile が存在する場合は何もせず終了する。
//
// @supabase/supabase-js は使わず fetch のみで実装している
// （Node 20 は native WebSocket 非対応のため、supabase-js の
//  createClient() がこのスクリプト単体実行では例外を投げるため）。

const SYSTEM_EMAIL = "system-refund@internal.invalid";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`環境変数 ${name} が設定されていません。`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const authHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  const existingRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?is_system=eq.true&select=id,email`,
    { headers: authHeaders },
  );
  if (!existingRes.ok) {
    console.error("既存 system profile の確認に失敗しました:", await existingRes.text());
    process.exit(1);
  }
  const existing = await existingRes.json();
  if (existing.length > 0) {
    console.log(`system profile は既に存在します（id: ${existing[0].id}, email: ${existing[0].email}）。何もしません。`);
    return;
  }

  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      email: SYSTEM_EMAIL,
      email_confirm: true,
      password: crypto.randomUUID(),
      user_metadata: { full_name: "System" },
    }),
  });
  if (!createRes.ok) {
    console.error("auth.users の作成に失敗しました:", await createRes.text());
    process.exit(1);
  }
  const created = await createRes.json();
  const userId = created.id;

  // on_auth_user_created トリガーが profiles を自動作成済み（role='user', is_system=false）。
  // is_system=true・role='system'（admin/business_admin/staff/user のいずれとも
  // 一致しない値。isAdminRole() 等の権限判定に一切マッチしないため、万一セッションが
  // 確立されても管理者権限を持たない）・表示名を更新する。
  // ログイン用パスワードは誰にも渡していないため実質ログイン不可。
  const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...authHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({
      is_system: true,
      role: "system",
      full_name: "System（自動返金アクター）",
    }),
  });
  if (!updateRes.ok) {
    console.error("profiles.is_system の更新に失敗しました:", await updateRes.text());
    process.exit(1);
  }

  console.log(`system profile を作成しました（id: ${userId}, email: ${SYSTEM_EMAIL}）。`);
}

main();

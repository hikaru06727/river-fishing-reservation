/**
 * E2E テストで使う固定データ・秘密情報。全て .env.local 経由で注入する。
 * 未設定の場合はテスト起動時に分かりやすいエラーで落とす。
 */

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `[e2e/fixtures] 環境変数 ${name} が未設定です。.env.local に設定してから再実行してください。`,
    );
  }
  return value;
}

export function getE2EFixtures() {
  return {
    testUserEmail: requireEnv("E2E_TEST_USER_EMAIL"),
    adminEmail: requireEnv("E2E_ADMIN_EMAIL"),
    adminPassword: requireEnv("E2E_ADMIN_PASSWORD"),
    spotId: requireEnv("E2E_SPOT_ID"),
    planSlug: requireEnv("E2E_PLAN_SLUG"),
    productId: requireEnv("E2E_PRODUCT_ID"),
    testLoginSecret: requireEnv("E2E_TEST_LOGIN_SECRET"),
  };
}

export type E2EFixtures = ReturnType<typeof getE2EFixtures>;

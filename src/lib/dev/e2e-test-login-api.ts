/** E2E テスト専用ログインAPI（/api/test/login）の有効化判定 */

export type E2ETestLoginGateDebug = {
  nodeEnv: string | undefined;
  vercelEnv: string | undefined;
  isVercel: boolean;
  hasSecret: boolean;
  explicitlyEnabled: boolean;
  enabled: boolean;
};

function getE2ETestLoginSecret(): string | undefined {
  const secret = process.env.E2E_TEST_LOGIN_SECRET?.trim();
  return secret || undefined;
}

/**
 * Playwright などの E2E テストが Magic Link ログインを経由せずセッションを
 * 発行するための専用エンドポイントのゲート。dev-admin-api.ts と同じ設計だが、
 * ADMIN_SECRET とは別の専用シークレット・専用フラグを要求する（用途混在防止）。
 *
 * 以下を全て満たす場合のみ有効:
 * - NODE_ENV !== "production"
 * - VERCEL !== "1"（ホスティング環境では常に無効）
 * - E2E_TEST_LOGIN_ENABLED === "true"（明示フラグ）
 * - E2E_TEST_LOGIN_SECRET が設定済み
 */
export function isE2ETestLoginEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  if (process.env.VERCEL === "1") {
    return false;
  }

  if (process.env.E2E_TEST_LOGIN_ENABLED !== "true") {
    return false;
  }

  if (!getE2ETestLoginSecret()) {
    return false;
  }

  return true;
}

export function getE2ETestLoginGateDebug(): E2ETestLoginGateDebug {
  return {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    isVercel: process.env.VERCEL === "1",
    hasSecret: Boolean(getE2ETestLoginSecret()),
    explicitlyEnabled: process.env.E2E_TEST_LOGIN_ENABLED === "true",
    enabled: isE2ETestLoginEnabled(),
  };
}

export type E2ETestLoginSecretValidation = {
  ok: boolean;
  hasHeader: boolean;
  secretMatches: boolean;
};

export function validateE2ETestLoginSecret(request: Request): E2ETestLoginSecretValidation {
  const expected = getE2ETestLoginSecret();
  const provided = request.headers.get("x-e2e-test-secret")?.trim();

  const hasHeader = Boolean(provided);
  const secretMatches = Boolean(expected && provided && provided === expected);

  return {
    ok: secretMatches,
    hasHeader,
    secretMatches,
  };
}

export function logE2ETestLoginGateDenied(gateDebug: E2ETestLoginGateDebug): void {
  console.warn("[api/test/login] Access denied (E2E test login gate).", gateDebug);
}

export function logE2ETestLoginSecretRejected(validation: E2ETestLoginSecretValidation): void {
  console.warn("[api/test/login] Forbidden (x-e2e-test-secret).", {
    hasHeader: validation.hasHeader,
    secretMatches: validation.secretMatches,
  });
}

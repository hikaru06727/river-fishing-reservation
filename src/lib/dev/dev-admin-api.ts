/** 開発専用 admin API（send-test-email / set-role / set-password）の有効化判定 */

export type DevAdminApiGateDebug = {
  nodeEnv: string | undefined;
  vercelEnv: string | undefined;
  isVercel: boolean;
  hasAdminSecret: boolean;
  enabled: boolean;
};

function getAdminSecret(): string | undefined {
  const secret = process.env.ADMIN_SECRET?.trim();
  return secret || undefined;
}

/**
 * ローカル開発で ADMIN_SECRET が設定されていれば有効。
 * Vercel 上（preview / production）は常に無効。
 *
 * 旧実装は NODE_ENV=production のみで拒否していたため、
 * ローカルの `next start` でも 403 になっていた。
 */
export function isDevAdminApiEnabled(): boolean {
  if (!getAdminSecret()) {
    return false;
  }

  if (process.env.VERCEL === "1") {
    return false;
  }

  return true;
}

export function getDevAdminApiGateDebug(): DevAdminApiGateDebug {
  const hasAdminSecret = Boolean(getAdminSecret());
  return {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    isVercel: process.env.VERCEL === "1",
    hasAdminSecret,
    enabled: isDevAdminApiEnabled(),
  };
}

export type DevAdminSecretValidation = {
  ok: boolean;
  hasHeader: boolean;
  secretMatches: boolean;
};

export function validateDevAdminSecret(request: Request): DevAdminSecretValidation {
  const expected = getAdminSecret();
  const provided = request.headers.get("x-admin-secret")?.trim();

  const hasHeader = Boolean(provided);
  const secretMatches = Boolean(expected && provided && provided === expected);

  return {
    ok: secretMatches,
    hasHeader,
    secretMatches,
  };
}

export function logDevAdminApiGateDenied(routeLabel: string, debug: DevAdminApiGateDebug): void {
  console.warn(`[${routeLabel}] Access denied (dev admin API gate).`, {
    nodeEnv: debug.nodeEnv,
    vercelEnv: debug.vercelEnv ?? null,
    isVercel: debug.isVercel,
    hasAdminSecret: debug.hasAdminSecret,
    enabled: debug.enabled,
  });
}

export function logDevAdminSecretRejected(
  routeLabel: string,
  validation: DevAdminSecretValidation,
): void {
  console.warn(`[${routeLabel}] Forbidden (x-admin-secret).`, {
    hasHeader: validation.hasHeader,
    secretMatches: validation.secretMatches,
  });
}

export type CronSecretValidation =
  | { ok: true }
  | { ok: false; reason: "missing_env" | "missing_header" | "mismatch" };

/**
 * Cron 用 API route の認証。
 * Authorization: Bearer <CRON_SECRET> または x-cron-secret ヘッダーを照合する。
 */
export function validateCronSecret(request: Request): CronSecretValidation {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return { ok: false, reason: "missing_env" };
  }

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${secret}`) {
    return { ok: true };
  }

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret === secret) {
    return { ok: true };
  }

  if (!authorization && !headerSecret) {
    return { ok: false, reason: "missing_header" };
  }

  return { ok: false, reason: "mismatch" };
}

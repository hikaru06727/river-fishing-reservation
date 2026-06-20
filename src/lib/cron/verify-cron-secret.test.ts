import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateCronSecret } from "@/lib/cron/verify-cron-secret";

describe("validateCronSecret", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, CRON_SECRET: "cron-test-secret" };
  });

  afterEach(() => {
    process.env = env;
  });

  it("Authorization Bearer で認証できる", () => {
    const request = new Request("http://localhost/api/cron/expire-pending-reservations", {
      headers: { authorization: "Bearer cron-test-secret" },
    });

    expect(validateCronSecret(request)).toEqual({ ok: true });
  });

  it("x-cron-secret ヘッダーで認証できる", () => {
    const request = new Request("http://localhost/api/cron/expire-pending-reservations", {
      headers: { "x-cron-secret": "cron-test-secret" },
    });

    expect(validateCronSecret(request)).toEqual({ ok: true });
  });

  it("秘密不一致は拒否する", () => {
    const request = new Request("http://localhost/api/cron/expire-pending-reservations", {
      headers: { authorization: "Bearer wrong-secret" },
    });

    expect(validateCronSecret(request)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("CRON_SECRET 未設定は拒否する", () => {
    delete process.env.CRON_SECRET;
    const request = new Request("http://localhost/api/cron/expire-pending-reservations");

    expect(validateCronSecret(request)).toEqual({ ok: false, reason: "missing_env" });
  });
});

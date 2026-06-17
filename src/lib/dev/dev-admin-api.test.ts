import { afterEach, describe, expect, it } from "vitest";
import {
  getDevAdminApiGateDebug,
  isDevAdminApiEnabled,
  validateDevAdminSecret,
} from "@/lib/dev/dev-admin-api";

describe("isDevAdminApiEnabled", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("ADMIN_SECRET あり・ローカル dev → 有効", () => {
    process.env = {
      ...env,
      ADMIN_SECRET: "dev-local-secret-123",
      NODE_ENV: "development",
    };
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;

    expect(isDevAdminApiEnabled()).toBe(true);
  });

  it("ADMIN_SECRET あり・ローカル next start (NODE_ENV=production) → 有効", () => {
    process.env = {
      ...env,
      ADMIN_SECRET: "dev-local-secret-123",
      NODE_ENV: "production",
    };
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;

    expect(isDevAdminApiEnabled()).toBe(true);
  });

  it("ADMIN_SECRET 未設定 → 無効", () => {
    process.env = { ...env, NODE_ENV: "development" };
    delete process.env.ADMIN_SECRET;

    expect(isDevAdminApiEnabled()).toBe(false);
  });

  it("Vercel 上 → 無効（ADMIN_SECRET があっても）", () => {
    process.env = {
      ...env,
      ADMIN_SECRET: "dev-local-secret-123",
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "production",
    };

    expect(isDevAdminApiEnabled()).toBe(false);
  });
});

describe("validateDevAdminSecret", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("ヘッダ一致 → ok", () => {
    process.env = { ...env, ADMIN_SECRET: "dev-local-secret-123" };

    const request = new Request("http://localhost/api/dev/send-test-email", {
      headers: { "x-admin-secret": "dev-local-secret-123" },
    });

    expect(validateDevAdminSecret(request)).toEqual({
      ok: true,
      hasHeader: true,
      secretMatches: true,
    });
  });

  it("ヘッダ不一致 → ok false", () => {
    process.env = { ...env, ADMIN_SECRET: "dev-local-secret-123" };

    const request = new Request("http://localhost/api/dev/send-test-email", {
      headers: { "x-admin-secret": "wrong" },
    });

    const result = validateDevAdminSecret(request);
    expect(result.ok).toBe(false);
    expect(result.hasHeader).toBe(true);
    expect(result.secretMatches).toBe(false);
  });
});

describe("getDevAdminApiGateDebug", () => {
  it("hasAdminSecret は secret 値を返さない boolean のみ", () => {
    const debug = getDevAdminApiGateDebug();
    expect(typeof debug.hasAdminSecret).toBe("boolean");
    expect(debug).not.toHaveProperty("adminSecret");
  });
});

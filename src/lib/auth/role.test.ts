import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getRoleFromUser, isAdminUser } from "./role";

function makeUser(metadata: Record<string, unknown> | undefined): User {
  return {
    id: "user-1",
    app_metadata: {},
    user_metadata: metadata ?? {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
  } as User;
}

describe("getRoleFromUser", () => {
  it("user_metadata.role を返す", () => {
    const user = makeUser({ role: "admin" });
    expect(getRoleFromUser(user)).toBe("admin");
  });

  it("role がない場合は undefined", () => {
    expect(getRoleFromUser(makeUser({}))).toBeUndefined();
    expect(getRoleFromUser(null)).toBeUndefined();
    expect(getRoleFromUser(undefined)).toBeUndefined();
  });
});

describe("isAdminUser", () => {
  it('user_metadata.role === "admin" のとき true', () => {
    expect(isAdminUser(makeUser({ role: "admin" }))).toBe(true);
  });

  it("role がない場合は false", () => {
    expect(isAdminUser(makeUser({}))).toBe(false);
    expect(isAdminUser(makeUser({ role: "user" }))).toBe(false);
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });
});

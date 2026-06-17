import { describe, expect, it } from "vitest";
import {
  getRoleFromProfile,
  hasRole,
  isAdminProfile,
  isAdminRole,
  isBusinessAdminRole,
  isManagementProfile,
  isManagementRole,
} from "./role";
import type { Profile } from "@/types/database";

function makeProfile(role: Profile["role"]): Profile {
  return {
    id: "user-1",
    email: "test@example.com",
    full_name: null,
    role,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("getRoleFromProfile", () => {
  it("profiles.role を返す", () => {
    expect(getRoleFromProfile(makeProfile("admin"))).toBe("admin");
  });

  it("profile がない場合は undefined", () => {
    expect(getRoleFromProfile(null)).toBeUndefined();
    expect(getRoleFromProfile(undefined)).toBeUndefined();
  });
});

describe("isAdminRole / isAdminProfile", () => {
  it('role === "admin" のとき true', () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminProfile(makeProfile("admin"))).toBe(true);
  });

  it("admin 以外は false", () => {
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminProfile(makeProfile("user"))).toBe(false);
    expect(isAdminProfile(null)).toBe(false);
  });
});

describe("isBusinessAdminRole", () => {
  it("将来用: business_admin を判定できる", () => {
    expect(isBusinessAdminRole("business_admin")).toBe(true);
    expect(isBusinessAdminRole("admin")).toBe(false);
  });
});

describe("isManagementRole / isManagementProfile", () => {
  it("admin は管理ロール", () => {
    expect(isManagementRole("admin")).toBe(true);
    expect(isManagementProfile(makeProfile("admin"))).toBe(true);
  });

  it("将来: business_admin も管理ロール", () => {
    expect(isManagementRole("business_admin")).toBe(true);
  });

  it("user は管理ロールではない", () => {
    expect(isManagementRole("user")).toBe(false);
    expect(isManagementProfile(makeProfile("user"))).toBe(false);
  });
});

describe("hasRole", () => {
  it("指定ロールと一致するとき true", () => {
    expect(hasRole(makeProfile("admin"), "admin")).toBe(true);
    expect(hasRole(makeProfile("user"), "user")).toBe(true);
  });
});

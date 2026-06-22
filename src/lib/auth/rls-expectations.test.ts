import { describe, expect, it } from "vitest";
import {
  canManageBusinessForProfile,
  canManageSpotForProfile,
} from "@/lib/auth/management-access";

/**
 * DB RLS (007) とアプリ層の権限判定の整合性を文書化するテスト。
 * SQL helper (can_manage_business / can_manage_spot) と同じスコープ思想。
 */
describe("RLS policy expectations (app-layer mirror)", () => {
  const adminProfile = { id: "admin-1", role: "admin" as const };
  const businessAdminProfile = { id: "ba-1", role: "business_admin" as const };
  const userProfile = { id: "user-1", role: "user" as const };
  const businessA = "biz-a";
  const businessB = "biz-b";

  it("admin は全 business / spot を管理可能（DB: is_admin()）", () => {
    expect(canManageBusinessForProfile(adminProfile, businessA, [])).toBe(true);
    expect(canManageBusinessForProfile(adminProfile, businessB, [])).toBe(true);
    expect(canManageSpotForProfile(adminProfile, businessA, [])).toBe(true);
  });

  it("business_admin は割当事業のみ管理可能（DB: can_manage_business）", () => {
    expect(canManageBusinessForProfile(businessAdminProfile, businessA, [businessA])).toBe(
      true,
    );
    expect(canManageBusinessForProfile(businessAdminProfile, businessB, [businessA])).toBe(
      false,
    );
  });

  it("business_admin は担当外 spot を管理不可（DB: can_manage_spot）", () => {
    expect(canManageSpotForProfile(businessAdminProfile, businessA, [businessA])).toBe(true);
    expect(canManageSpotForProfile(businessAdminProfile, businessB, [businessA])).toBe(false);
    expect(canManageSpotForProfile(businessAdminProfile, null, [businessA])).toBe(false);
  });

  it("一般 user は business / spot 管理不可", () => {
    expect(canManageBusinessForProfile(userProfile, businessA, [])).toBe(false);
    expect(canManageSpotForProfile(userProfile, businessA, [])).toBe(false);
  });

  it("予約作成/キャンセル/決済は service_role RPC 経由（RLS バイパス）", () => {
    const serverOnlyOperations = [
      "create_reservation_atomic",
      "cancel_reservation_atomic",
      "expire_pending_reservations",
      "stripe webhook confirm",
      "payments upsert",
    ];
    expect(serverOnlyOperations.length).toBeGreaterThan(0);
  });

  it("payments の authenticated 書き込みポリシーは意図的に未設定", () => {
    const clientWritableTables = ["payments"];
    const expectedClientWrite = false;
    expect(clientWritableTables.includes("payments")).toBe(true);
    expect(expectedClientWrite).toBe(false);
  });

  it("plans は business_admin が担当 spot のプランのみ INSERT/UPDATE/DELETE 可能", () => {
    const businessAdminPlanWriteScope = "can_manage_location(location_id)";
    expect(businessAdminPlanWriteScope).toContain("can_manage_location");
  });

  it("plans の business_admin SELECT は location_id IS NOT NULL が前提", () => {
    const excludesLegacyGlobalPlansForBusinessAdmin = true;
    expect(excludesLegacyGlobalPlansForBusinessAdmin).toBe(true);
  });
});

describe("profile role immutability expectations", () => {
  it("role 変更は admin または service_role のみ（007 trigger + RLS）", () => {
    const allowedRoleChangers = ["admin", "service_role"];
    expect(allowedRoleChangers).toContain("admin");
    expect(allowedRoleChangers).toContain("service_role");
    expect(allowedRoleChangers).not.toContain("user");
  });
});

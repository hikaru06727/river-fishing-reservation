import { describe, expect, it } from "vitest";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

describe("PERMISSIONS", () => {
  it("business_admin は全パーミッションを持つ", () => {
    for (const key of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
      expect(PERMISSIONS[key]).toContain("business_admin");
    }
  });

  it("staff は STAFF_MANAGE を持たない", () => {
    expect(PERMISSIONS.STAFF_MANAGE).not.toContain("staff");
  });

  it("staff は PRODUCT_MANAGE を持たない", () => {
    expect(PERMISSIONS.PRODUCT_MANAGE).not.toContain("staff");
  });

  it("staff は BUSINESS_SETTINGS を持たない", () => {
    expect(PERMISSIONS.BUSINESS_SETTINGS).not.toContain("staff");
  });

  it("staff は TAX_SETTINGS を持たない", () => {
    expect(PERMISSIONS.TAX_SETTINGS).not.toContain("staff");
  });

  it("staff は POS_OPERATE を持つ", () => {
    expect(PERMISSIONS.POS_OPERATE).toContain("staff");
  });

  it("staff は SALES_VIEW を持つ", () => {
    expect(PERMISSIONS.SALES_VIEW).toContain("staff");
  });

  it("staff は RESERVATION_VIEW を持つ", () => {
    expect(PERMISSIONS.RESERVATION_VIEW).toContain("staff");
  });
});

describe("hasPermission", () => {
  it("business_admin は全パーミッションを持つ", () => {
    expect(hasPermission("business_admin", "POS_OPERATE")).toBe(true);
    expect(hasPermission("business_admin", "PRODUCT_MANAGE")).toBe(true);
    expect(hasPermission("business_admin", "STAFF_MANAGE")).toBe(true);
    expect(hasPermission("business_admin", "BUSINESS_SETTINGS")).toBe(true);
    expect(hasPermission("business_admin", "SALES_VIEW")).toBe(true);
  });

  it("staff は POS 操作・売上閲覧・予約閲覧ができる", () => {
    expect(hasPermission("staff", "POS_OPERATE")).toBe(true);
    expect(hasPermission("staff", "POS_CLOSE")).toBe(true);
    expect(hasPermission("staff", "SALES_VIEW")).toBe(true);
    expect(hasPermission("staff", "RESERVATION_VIEW")).toBe(true);
    expect(hasPermission("staff", "RESERVATION_CASH_COMPLETE")).toBe(true);
  });

  it("staff は商品管理・スタッフ管理・設定変更ができない", () => {
    expect(hasPermission("staff", "PRODUCT_MANAGE")).toBe(false);
    expect(hasPermission("staff", "STAFF_MANAGE")).toBe(false);
    expect(hasPermission("staff", "BUSINESS_SETTINGS")).toBe(false);
    expect(hasPermission("staff", "TAX_SETTINGS")).toBe(false);
    expect(hasPermission("staff", "CLOSE_CORRECTION_APPROVE")).toBe(false);
  });

  it("user は全パーミッションを持たない", () => {
    expect(hasPermission("user", "POS_OPERATE")).toBe(false);
    expect(hasPermission("user", "SALES_VIEW")).toBe(false);
    expect(hasPermission("user", "PRODUCT_MANAGE")).toBe(false);
  });

  it("admin は全パーミッションを持つ（スーパー管理者）", () => {
    expect(hasPermission("admin", "POS_OPERATE")).toBe(true);
    expect(hasPermission("admin", "PRODUCT_MANAGE")).toBe(true);
    expect(hasPermission("admin", "STAFF_MANAGE")).toBe(true);
    expect(hasPermission("admin", "BUSINESS_SETTINGS")).toBe(true);
    expect(hasPermission("admin", "TAX_SETTINGS")).toBe(true);
    expect(hasPermission("admin", "SALES_VIEW")).toBe(true);
    expect(hasPermission("admin", "CLOSE_CORRECTION_APPROVE")).toBe(true);
  });

  it("空文字・null 相当の文字列は false", () => {
    expect(hasPermission("", "POS_OPERATE")).toBe(false);
    expect(hasPermission("unknown", "SALES_VIEW")).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getProfileMock, findAssignedBusinessIdsByStaffUserIdMock } = vi.hoisted(() => ({
  getProfileMock: vi.fn(),
  findAssignedBusinessIdsByStaffUserIdMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/get-user", () => ({ getProfile: getProfileMock }));
vi.mock("@/lib/repositories/staff-members.repository", () => ({
  findAssignedBusinessIdsByStaffUserId: findAssignedBusinessIdsByStaffUserIdMock,
}));

import { createClient } from "@/lib/supabase/server";
import {
  findActiveBusinessBySlug,
  findManageableBusinesses,
} from "./businesses.repository";

describe("findActiveBusinessBySlug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is_active な事業を slug で解決する", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({
      data: { id: "biz-1", name: "テスト事業", slug: "test-shop" },
      error: null,
    });
    const eqActiveFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const eqSlugFn = vi.fn().mockReturnValue({ eq: eqActiveFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqSlugFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findActiveBusinessBySlug("test-shop");

    expect(result?.id).toBe("biz-1");
    expect(eqSlugFn).toHaveBeenCalledWith("slug", "test-shop");
    expect(eqActiveFn).toHaveBeenCalledWith("is_active", true);
  });

  it("存在しない slug は null を返す", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqActiveFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const eqSlugFn = vi.fn().mockReturnValue({ eq: eqActiveFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqSlugFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findActiveBusinessBySlug("unknown-shop");
    expect(result).toBeNull();
  });

  it("DBエラー時は例外をスロー", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const eqActiveFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const eqSlugFn = vi.fn().mockReturnValue({ eq: eqActiveFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqSlugFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    await expect(findActiveBusinessBySlug("test-shop")).rejects.toThrow("DB error");
  });
});

const ALL_BUSINESSES = [
  { id: "biz-1", name: "事業1", is_active: true },
  { id: "biz-2", name: "事業2", is_active: true },
];

function mockBusinessesQuery(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ order });
  return { select };
}

function mockAssignmentsQuery(result: { data: unknown; error: unknown }) {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

describe("findManageableBusinesses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin は全事業を取得できる", async () => {
    const businessesTable = mockBusinessesQuery({ data: ALL_BUSINESSES, error: null });
    const from = vi.fn().mockReturnValue(businessesTable);
    vi.mocked(createClient).mockResolvedValue({ from } as any);
    getProfileMock.mockResolvedValue({ id: "admin-1", role: "admin" });

    const result = await findManageableBusinesses();

    expect(result).toEqual(ALL_BUSINESSES);
  });

  it("business_admin は割当事業のみに絞り込まれる", async () => {
    const businessesTable = mockBusinessesQuery({ data: ALL_BUSINESSES, error: null });
    const assignmentsTable = mockAssignmentsQuery({
      data: [{ business_id: "biz-1" }],
      error: null,
    });
    const from = vi.fn((table: string) =>
      table === "businesses" ? businessesTable : assignmentsTable,
    );
    vi.mocked(createClient).mockResolvedValue({ from } as any);
    getProfileMock.mockResolvedValue({ id: "biz-admin-1", role: "business_admin" });

    const result = await findManageableBusinesses();

    expect(result).toEqual([{ id: "biz-1", name: "事業1", is_active: true }]);
  });

  it("staff は staff_members 経由の割当事業のみに絞り込まれる", async () => {
    const businessesTable = mockBusinessesQuery({ data: ALL_BUSINESSES, error: null });
    const from = vi.fn().mockReturnValue(businessesTable);
    vi.mocked(createClient).mockResolvedValue({ from } as any);
    getProfileMock.mockResolvedValue({ id: "staff-1", role: "staff" });
    findAssignedBusinessIdsByStaffUserIdMock.mockResolvedValue(["biz-2"]);

    const result = await findManageableBusinesses();

    expect(result).toEqual([{ id: "biz-2", name: "事業2", is_active: true }]);
  });

  it("未ログインの場合は空配列を返す", async () => {
    const businessesTable = mockBusinessesQuery({ data: ALL_BUSINESSES, error: null });
    const from = vi.fn().mockReturnValue(businessesTable);
    vi.mocked(createClient).mockResolvedValue({ from } as any);
    getProfileMock.mockResolvedValue(null);

    const result = await findManageableBusinesses();

    expect(result).toEqual([]);
  });
});

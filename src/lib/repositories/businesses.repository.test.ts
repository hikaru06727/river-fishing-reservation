import { beforeEach, describe, expect, it, vi } from "vitest";

const { getProfileMock } = vi.hoisted(() => ({
  getProfileMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/get-user", () => ({ getProfile: getProfileMock }));

import { createClient } from "@/lib/supabase/server";
import { SINGLE_BUSINESS_ID } from "@/lib/feature-flags";
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

const SINGLE_BUSINESS = { id: SINGLE_BUSINESS_ID, name: "奥多摩川フィッシングパーク", is_active: true };

function mockBusinessRow(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq };
}

describe("findManageableBusinesses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ログイン中なら SINGLE_BUSINESS_ID の事業を1件返す", async () => {
    const { select, eq } = mockBusinessRow({ data: SINGLE_BUSINESS, error: null });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(createClient).mockResolvedValue({ from } as any);
    getProfileMock.mockResolvedValue({ id: "user-1", role: "business_admin" });

    const result = await findManageableBusinesses();

    expect(result).toEqual([SINGLE_BUSINESS]);
    expect(eq).toHaveBeenCalledWith("id", SINGLE_BUSINESS_ID);
  });

  it("対象の business が存在しない場合は空配列を返す", async () => {
    const { select } = mockBusinessRow({ data: null, error: null });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(createClient).mockResolvedValue({ from } as any);
    getProfileMock.mockResolvedValue({ id: "user-1", role: "admin" });

    const result = await findManageableBusinesses();

    expect(result).toEqual([]);
  });

  it("未ログインの場合は空配列を返す（DBに問い合わせない）", async () => {
    const from = vi.fn();
    vi.mocked(createClient).mockResolvedValue({ from } as any);
    getProfileMock.mockResolvedValue(null);

    const result = await findManageableBusinesses();

    expect(result).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("DBエラー時は例外をスロー", async () => {
    const { select } = mockBusinessRow({ data: null, error: { message: "DB error" } });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(createClient).mockResolvedValue({ from } as any);
    getProfileMock.mockResolvedValue({ id: "user-1", role: "admin" });

    await expect(findManageableBusinesses()).rejects.toThrow("DB error");
  });
});

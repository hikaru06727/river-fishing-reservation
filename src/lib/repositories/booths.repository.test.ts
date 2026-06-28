import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import {
  findBoothsByBusinessId,
  findBoothById,
  insertBooth,
  updateBooth,
} from "./booths.repository";

const SAMPLE_BOOTH = {
  id: "booth-1",
  business_id: "biz-1",
  location_id: null,
  name: "テストブース",
  description: null,
  capacity: 1,
  price: 5000,
  tax_category: "standard" as const,
  status: "active" as const,
  created_at: "2026-06-29T00:00:00Z",
  updated_at: "2026-06-29T00:00:00Z",
};

describe("findBoothsByBusinessId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("事業IDに紐づくブース一覧を返す", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: [SAMPLE_BOOTH], error: null });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findBoothsByBusinessId("biz-1");
    expect(result).toEqual([SAMPLE_BOOTH]);
    expect(fromFn).toHaveBeenCalledWith("booths");
    expect(eqFn).toHaveBeenCalledWith("business_id", "biz-1");
  });

  it("DBエラー時は Error をスロー", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    await expect(findBoothsByBusinessId("biz-1")).rejects.toThrow("DB error");
  });
});

describe("findBoothById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("IDと事業IDでブースを返す", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: SAMPLE_BOOTH, error: null });
    const eqBizFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const eqIdFn = vi.fn().mockReturnValue({ eq: eqBizFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqIdFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findBoothById("booth-1", "biz-1");
    expect(result).toEqual(SAMPLE_BOOTH);
    expect(eqIdFn).toHaveBeenCalledWith("id", "booth-1");
    expect(eqBizFn).toHaveBeenCalledWith("business_id", "biz-1");
  });

  it("存在しない場合は null を返す", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqBizFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const eqIdFn = vi.fn().mockReturnValue({ eq: eqBizFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqIdFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findBoothById("nonexistent", "biz-1");
    expect(result).toBeNull();
  });
});

describe("insertBooth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ブースを作成して返す", async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: SAMPLE_BOOTH, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await insertBooth({
      business_id: "biz-1",
      name: "テストブース",
      price: 5000,
    });
    expect(result).toEqual(SAMPLE_BOOTH);
    expect(fromFn).toHaveBeenCalledWith("booths");
  });
});

describe("updateBooth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ブースを更新して返す", async () => {
    const updated = { ...SAMPLE_BOOTH, name: "更新後ブース" };
    const singleFn = vi.fn().mockResolvedValue({ data: updated, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const eqFn = vi.fn().mockReturnValue({ select: selectFn });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ update: updateFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await updateBooth("booth-1", { name: "更新後ブース" });
    expect(result.name).toBe("更新後ブース");
    expect(fromFn).toHaveBeenCalledWith("booths");
  });
});

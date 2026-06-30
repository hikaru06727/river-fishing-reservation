import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import {
  findPublishedProductById,
  findPublishedProductsByBusinessId,
  insertProduct,
  updateProduct,
} from "./products.repository";

const SAMPLE_PUBLIC_PRODUCT = {
  id: "product-1",
  business_id: "biz-1",
  name: "天然餌セット",
  price_excluding_tax: 1000,
  default_tax_rate: 10,
  image_url: null,
  track_inventory: true,
  stock_quantity: 0,
  description_online: "新鮮な天然餌のセットです。",
  shippable: true,
};

describe("findPublishedProductsByBusinessId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("公開中・販売中の商品のみを business_id でフィルタして返す", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: [SAMPLE_PUBLIC_PRODUCT], error: null });
    const eqStatusFn = vi.fn().mockReturnValue({ order: orderFn });
    const eqPublishedFn = vi.fn().mockReturnValue({ eq: eqStatusFn });
    const eqBusinessFn = vi.fn().mockReturnValue({ eq: eqPublishedFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqBusinessFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findPublishedProductsByBusinessId("biz-1");

    expect(result).toHaveLength(1);
    expect(eqBusinessFn).toHaveBeenCalledWith("business_id", "biz-1");
    expect(eqPublishedFn).toHaveBeenCalledWith("is_published_online", true);
    expect(eqStatusFn).toHaveBeenCalledWith("status", "on_sale");
  });

  it("DBエラー時は例外をスロー", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const eqStatusFn = vi.fn().mockReturnValue({ order: orderFn });
    const eqPublishedFn = vi.fn().mockReturnValue({ eq: eqStatusFn });
    const eqBusinessFn = vi.fn().mockReturnValue({ eq: eqPublishedFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqBusinessFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    await expect(findPublishedProductsByBusinessId("biz-1")).rejects.toThrow("DB error");
  });
});

describe("findPublishedProductById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("公開中・販売中・business_id一致の商品を返す", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: SAMPLE_PUBLIC_PRODUCT, error: null });
    const eqStatusFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const eqPublishedFn = vi.fn().mockReturnValue({ eq: eqStatusFn });
    const eqBusinessFn = vi.fn().mockReturnValue({ eq: eqPublishedFn });
    const eqIdFn = vi.fn().mockReturnValue({ eq: eqBusinessFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqIdFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findPublishedProductById("biz-1", "product-1");

    expect(result?.id).toBe("product-1");
    expect(eqIdFn).toHaveBeenCalledWith("id", "product-1");
    expect(eqBusinessFn).toHaveBeenCalledWith("business_id", "biz-1");
    expect(eqPublishedFn).toHaveBeenCalledWith("is_published_online", true);
    expect(eqStatusFn).toHaveBeenCalledWith("status", "on_sale");
  });

  it("該当商品が無ければ null を返す", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqStatusFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const eqPublishedFn = vi.fn().mockReturnValue({ eq: eqStatusFn });
    const eqBusinessFn = vi.fn().mockReturnValue({ eq: eqPublishedFn });
    const eqIdFn = vi.fn().mockReturnValue({ eq: eqBusinessFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqIdFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findPublishedProductById("biz-1", "nonexistent");
    expect(result).toBeNull();
  });
});

describe("insertProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("公開設定・在庫管理フィールドのデフォルト値を補完して挿入する", async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: SAMPLE_PUBLIC_PRODUCT, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    await insertProduct({
      business_id: "biz-1",
      name: "テスト商品",
      price_excluding_tax: 500,
    });

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        is_published_online: false,
        track_inventory: false,
        shippable: true,
        description_online: null,
      }),
    );
  });

  it("明示的に渡した公開設定・在庫管理フィールドを反映する", async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: SAMPLE_PUBLIC_PRODUCT, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    await insertProduct({
      business_id: "biz-1",
      name: "テスト商品",
      price_excluding_tax: 500,
      is_published_online: true,
      track_inventory: true,
      shippable: false,
      description_online: "オンライン説明",
    });

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        is_published_online: true,
        track_inventory: true,
        shippable: false,
        description_online: "オンライン説明",
      }),
    );
  });
});

describe("updateProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("公開設定・在庫管理フィールドのみを部分更新する", async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: SAMPLE_PUBLIC_PRODUCT, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const eqFn = vi.fn().mockReturnValue({ select: selectFn });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ update: updateFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    await updateProduct("product-1", { is_published_online: true, track_inventory: true });

    expect(updateFn).toHaveBeenCalledWith({
      is_published_online: true,
      track_inventory: true,
    });
  });
});

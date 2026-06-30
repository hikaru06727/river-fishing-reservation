import { beforeEach, describe, expect, it, vi } from "vitest";

const { findPublishedProductsByBusinessIdMock } = vi.hoisted(() => ({
  findPublishedProductsByBusinessIdMock: vi.fn(),
}));

vi.mock("@/lib/repositories/products.repository", () => ({
  findPublishedProductsByBusinessId: findPublishedProductsByBusinessIdMock,
}));

import { getPublishedProducts } from "./get-public-products";

describe("getPublishedProducts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("公開中商品のみを取得する repository 関数を呼び出し、ドメイン型へ変換する", async () => {
    findPublishedProductsByBusinessIdMock.mockResolvedValue([
      {
        id: "product-1",
        business_id: "biz-1",
        name: "天然餌セット",
        price_excluding_tax: 1000,
        default_tax_rate: 10,
        image_url: null,
        track_inventory: true,
        stock_quantity: 0,
        description_online: "説明",
        shippable: true,
      },
    ]);

    const result = await getPublishedProducts("biz-1");

    expect(findPublishedProductsByBusinessIdMock).toHaveBeenCalledWith("biz-1");
    expect(result).toEqual([
      {
        id: "product-1",
        name: "天然餌セット",
        price_excluding_tax: 1000,
        tax_rate_percent: 10,
        image_url: null,
        track_inventory: true,
        stock_quantity: 0,
      },
    ]);
  });

  it("非公開商品は repository 層のフィルタにより一覧に含まれない", async () => {
    findPublishedProductsByBusinessIdMock.mockResolvedValue([]);

    const result = await getPublishedProducts("biz-1");

    expect(result).toEqual([]);
  });

  it("repository が例外を投げた場合はユーザー向けエラーに変換する", async () => {
    findPublishedProductsByBusinessIdMock.mockRejectedValue(new Error("DB error"));

    await expect(getPublishedProducts("biz-1")).rejects.toThrow("商品データの取得に失敗しました");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { findActiveBusinessBySlugMock, findPublishedProductsByBusinessIdMock } = vi.hoisted(() => ({
  findActiveBusinessBySlugMock: vi.fn(),
  findPublishedProductsByBusinessIdMock: vi.fn(),
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findActiveBusinessBySlug: findActiveBusinessBySlugMock,
}));

vi.mock("@/lib/repositories/products.repository", () => ({
  findPublishedProductsByBusinessId: findPublishedProductsByBusinessIdMock,
}));

import { getPublishedProducts } from "./get-public-products";

describe("getPublishedProducts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("slug から事業を解決し、公開中商品のみをドメイン型へ変換して返す", async () => {
    findActiveBusinessBySlugMock.mockResolvedValue({
      id: "biz-1",
      name: "テスト事業",
      slug: "test-shop",
    });
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

    const result = await getPublishedProducts("test-shop");

    expect(findActiveBusinessBySlugMock).toHaveBeenCalledWith("test-shop");
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

  it("存在しない slug の場合は null を返す（呼び出し側で notFound）", async () => {
    findActiveBusinessBySlugMock.mockResolvedValue(null);

    const result = await getPublishedProducts("unknown-shop");

    expect(result).toBeNull();
    expect(findPublishedProductsByBusinessIdMock).not.toHaveBeenCalled();
  });

  it("非公開商品は repository 層のフィルタにより一覧に含まれない", async () => {
    findActiveBusinessBySlugMock.mockResolvedValue({
      id: "biz-1",
      name: "テスト事業",
      slug: "test-shop",
    });
    findPublishedProductsByBusinessIdMock.mockResolvedValue([]);

    const result = await getPublishedProducts("test-shop");

    expect(result).toEqual([]);
  });

  it("repository が例外を投げた場合はユーザー向けエラーに変換する", async () => {
    findActiveBusinessBySlugMock.mockRejectedValue(new Error("DB error"));

    await expect(getPublishedProducts("test-shop")).rejects.toThrow("商品データの取得に失敗しました");
  });
});

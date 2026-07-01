import { beforeEach, describe, expect, it, vi } from "vitest";

const { findActiveBusinessBySlugMock, findPublishedProductByIdMock } = vi.hoisted(() => ({
  findActiveBusinessBySlugMock: vi.fn(),
  findPublishedProductByIdMock: vi.fn(),
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findActiveBusinessBySlug: findActiveBusinessBySlugMock,
}));

vi.mock("@/lib/repositories/products.repository", () => ({
  findPublishedProductById: findPublishedProductByIdMock,
}));

import { getPublishedProduct } from "./get-public-product";

describe("getPublishedProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("slug から事業を解決し、公開中商品の詳細をドメイン型へ変換して返す", async () => {
    findActiveBusinessBySlugMock.mockResolvedValue({
      id: "biz-1",
      name: "テスト事業",
      slug: "test-shop",
    });
    findPublishedProductByIdMock.mockResolvedValue({
      id: "product-detail-1",
      business_id: "biz-1",
      name: "天然餌セット",
      price_excluding_tax: 1000,
      default_tax_rate: 10,
      image_url: "https://example.com/img.png",
      track_inventory: true,
      stock_quantity: 0,
      description_online: "新鮮な天然餌のセットです。",
      shippable: true,
    });

    const result = await getPublishedProduct("test-shop", "product-detail-1");

    expect(findActiveBusinessBySlugMock).toHaveBeenCalledWith("test-shop");
    expect(findPublishedProductByIdMock).toHaveBeenCalledWith("biz-1", "product-detail-1");
    expect(result).toEqual({
      id: "product-detail-1",
      name: "天然餌セット",
      price_excluding_tax: 1000,
      tax_rate_percent: 10,
      image_url: "https://example.com/img.png",
      track_inventory: true,
      stock_quantity: 0,
      description_online: "新鮮な天然餌のセットです。",
      shippable: true,
    });
  });

  it("存在しない slug の場合は null を返す（呼び出し側で notFound）", async () => {
    findActiveBusinessBySlugMock.mockResolvedValue(null);

    const result = await getPublishedProduct("unknown-shop", "product-detail-1");

    expect(result).toBeNull();
    expect(findPublishedProductByIdMock).not.toHaveBeenCalled();
  });

  it("非公開・他事業の商品は null を返す", async () => {
    findActiveBusinessBySlugMock.mockResolvedValue({
      id: "biz-1",
      name: "テスト事業",
      slug: "test-shop",
    });
    findPublishedProductByIdMock.mockResolvedValue(null);

    const result = await getPublishedProduct("test-shop", "product-detail-2");
    expect(result).toBeNull();
  });

  it("repository が例外を投げた場合はユーザー向けエラーに変換する", async () => {
    findActiveBusinessBySlugMock.mockRejectedValue(new Error("DB error"));

    await expect(getPublishedProduct("test-shop", "product-detail-3")).rejects.toThrow(
      "商品データの取得に失敗しました",
    );
  });
});

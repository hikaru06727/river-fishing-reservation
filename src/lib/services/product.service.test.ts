import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  insertProductMock,
  updateProductMock,
  deleteProductMock,
  findProductByIdMock,
  findAssignedBusinessIdsByUserIdMock,
  findAssignedBusinessIdsByStaffUserIdMock,
} = vi.hoisted(() => ({
  insertProductMock: vi.fn(),
  updateProductMock: vi.fn(),
  deleteProductMock: vi.fn(),
  findProductByIdMock: vi.fn(),
  findAssignedBusinessIdsByUserIdMock: vi.fn(),
  findAssignedBusinessIdsByStaffUserIdMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/repositories/products.repository", () => ({
  insertProduct: insertProductMock,
  updateProduct: updateProductMock,
  deleteProduct: deleteProductMock,
  findProductById: findProductByIdMock,
  findAllProductsByBusinessId: vi.fn(),
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: findAssignedBusinessIdsByUserIdMock,
}));

vi.mock("@/lib/repositories/staff-members.repository", () => ({
  findAssignedBusinessIdsByStaffUserId: findAssignedBusinessIdsByStaffUserIdMock,
}));

vi.mock("@/lib/repositories/product-sales.repository", () => ({
  deleteProductSale: vi.fn(),
  findProductSaleById: vi.fn(),
  findProductSalesByBusinessId: vi.fn(),
  insertProductSale: vi.fn(),
}));

vi.mock("@/lib/repositories/tax-rates.repository", () => ({
  getCurrentTaxRate: vi.fn().mockResolvedValue({ rate_percent: 10 }),
}));

import { createProduct, deleteProductById, updateProductById } from "./product.service";

const BUSINESS_ADMIN_PROFILE = { id: "admin-user", role: "business_admin" as const };
const STAFF_PROFILE = { id: "staff-user", role: "staff" as const };
const USER_PROFILE = { id: "regular-user", role: "user" as const };

const SAMPLE_PRODUCT = {
  id: "product-1",
  business_id: "biz-1",
  name: "天然餌セット",
  description: null,
  price_excluding_tax: 1000,
  stock_quantity: null,
  image_url: null,
  status: "on_sale" as const,
  default_tax_rate: 10,
  category: null,
  is_published_online: false,
  track_inventory: false,
  shippable: true,
  description_online: null,
  created_at: "2026-06-24T00:00:00Z",
  updated_at: "2026-06-24T00:00:00Z",
};

describe("createProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PRODUCT_MANAGE 権限を持つ staff は自事業の商品を登録できる", async () => {
    findAssignedBusinessIdsByStaffUserIdMock.mockResolvedValue(["biz-1"]);
    insertProductMock.mockResolvedValue(SAMPLE_PRODUCT);

    const result = await createProduct(STAFF_PROFILE, {
      business_id: "biz-1",
      name: "天然餌セット",
      price_excluding_tax: 1000,
    });

    expect(result.ok).toBe(true);
    expect(findAssignedBusinessIdsByStaffUserIdMock).toHaveBeenCalledWith("staff-user");
    expect(findAssignedBusinessIdsByUserIdMock).not.toHaveBeenCalled();
  });

  it("staff は他事業の商品を登録できない（IDOR ブロック）", async () => {
    findAssignedBusinessIdsByStaffUserIdMock.mockResolvedValue(["biz-1"]);

    const result = await createProduct(STAFF_PROFILE, {
      business_id: "biz-other",
      name: "天然餌セット",
      price_excluding_tax: 1000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("権限");
    expect(insertProductMock).not.toHaveBeenCalled();
  });

  it("PRODUCT_MANAGE 権限のない user ロールは商品登録できない", async () => {
    const result = await createProduct(USER_PROFILE, {
      business_id: "biz-1",
      name: "天然餌セット",
      price_excluding_tax: 1000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("権限");
    expect(insertProductMock).not.toHaveBeenCalled();
  });

  it("business_admin は自事業の商品に公開設定・在庫管理フィールドを渡して登録できる", async () => {
    findAssignedBusinessIdsByUserIdMock.mockResolvedValue(["biz-1"]);
    insertProductMock.mockResolvedValue({ ...SAMPLE_PRODUCT, is_published_online: true });

    const result = await createProduct(BUSINESS_ADMIN_PROFILE, {
      business_id: "biz-1",
      name: "天然餌セット",
      price_excluding_tax: 1000,
      is_published_online: true,
      track_inventory: true,
      stock_quantity: 5,
    });

    expect(result.ok).toBe(true);
    expect(insertProductMock).toHaveBeenCalledWith(
      expect.objectContaining({
        is_published_online: true,
        track_inventory: true,
        stock_quantity: 5,
      }),
    );
  });
});

describe("updateProductById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("staff は自事業の商品の公開設定を更新できる", async () => {
    findProductByIdMock.mockResolvedValue(SAMPLE_PRODUCT);
    findAssignedBusinessIdsByStaffUserIdMock.mockResolvedValue(["biz-1"]);
    updateProductMock.mockResolvedValue({ ...SAMPLE_PRODUCT, is_published_online: true });

    const result = await updateProductById(STAFF_PROFILE, "product-1", {
      is_published_online: true,
    });

    expect(result.ok).toBe(true);
    expect(updateProductMock).toHaveBeenCalledWith("product-1", { is_published_online: true });
  });

  it("staff は他事業の商品を更新できない（IDOR ブロック）", async () => {
    findProductByIdMock.mockResolvedValue({ ...SAMPLE_PRODUCT, business_id: "biz-other" });
    findAssignedBusinessIdsByStaffUserIdMock.mockResolvedValue(["biz-1"]);

    const result = await updateProductById(STAFF_PROFILE, "product-1", {
      is_published_online: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("権限");
    expect(updateProductMock).not.toHaveBeenCalled();
  });
});

describe("deleteProductById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("staff は自事業の商品を削除できる", async () => {
    findProductByIdMock.mockResolvedValue(SAMPLE_PRODUCT);
    findAssignedBusinessIdsByStaffUserIdMock.mockResolvedValue(["biz-1"]);
    deleteProductMock.mockResolvedValue(undefined);

    const result = await deleteProductById(STAFF_PROFILE, "product-1");

    expect(result.ok).toBe(true);
    expect(deleteProductMock).toHaveBeenCalledWith("product-1");
  });
});

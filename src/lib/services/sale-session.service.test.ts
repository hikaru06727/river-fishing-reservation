import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: vi.fn(),
}));

vi.mock("@/lib/repositories/products.repository", () => ({
  findProductById: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock("@/lib/repositories/product-sales.repository", () => ({
  insertProductSale: vi.fn(),
  deleteProductSalesBySessionId: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/repositories/sale-sessions.repository", () => ({
  insertSaleSession: vi.fn(),
  insertSaleSessionItems: vi.fn(),
  insertSaleSessionDiscounts: vi.fn(),
  deleteSaleSessionById: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/repositories/tax-rates.repository", () => ({
  getCurrentTaxRate: vi.fn(),
}));

vi.mock("@/lib/services/payment-ledger.service", () => ({
  recordPaymentLedger: vi.fn().mockResolvedValue({}),
  toLedgerPaymentMethod: vi.fn((m: string | null) => {
    if (m === "cash" || m === "cash_at_venue") return "cash";
    if (m === "card" || m === "stripe" || m === "credit_card" || m === "online") return "card";
    return "other";
  }),
}));

import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { findProductById, updateProduct } from "@/lib/repositories/products.repository";
import { deleteProductSalesBySessionId, insertProductSale } from "@/lib/repositories/product-sales.repository";
import { deleteSaleSessionById, insertSaleSession, insertSaleSessionDiscounts, insertSaleSessionItems } from "@/lib/repositories/sale-sessions.repository";
import { getCurrentTaxRate } from "@/lib/repositories/tax-rates.repository";
import { recordPaymentLedger } from "@/lib/services/payment-ledger.service";
import { createSaleSession } from "./sale-session.service";

const bizA = "11111111-1111-4111-8111-111111111111";
const bizB = "22222222-2222-4222-8222-222222222222";
const prodId1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const prodId2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sessionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const adminProfile = { id: "admin-id", role: "admin" as const };
const baProfile = { id: "ba-id", role: "business_admin" as const };
const userProfile = { id: "user-id", role: "user" as const };

const fakeProduct1 = {
  id: prodId1,
  business_id: bizA,
  name: "えさ",
  description: null,
  price_excluding_tax: 500,
  stock_quantity: 10,
  image_url: null,
  status: "on_sale" as const,
  default_tax_rate: 10,
  category: null,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

const fakeProduct2 = {
  id: prodId2,
  business_id: bizA,
  name: "仕掛け",
  description: null,
  price_excluding_tax: 200,
  stock_quantity: 5,
  image_url: null,
  status: "on_sale" as const,
  default_tax_rate: 10,
  category: null,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

const fakeTaxRate = { id: "tax-id", rate_percent: 10, valid_from: "2024-01-01", valid_until: null, created_by: null, created_at: "2024-01-01T00:00:00Z" };

const fakeSession = {
  id: sessionId,
  business_id: bizA,
  sold_at: "2026-06-23T10:00:00Z",
  payment_method: "cash" as const,
  tax_rate_percent: 10,
  subtotal_amount: 1000,
  discount_amount: 0,
  tax_amount: 100,
  total_amount: 1100,
  note: null,
  payment_other_label: null,
  created_by: "ba-id",
  created_at: "2026-06-23T10:00:00Z",
};

describe("createSaleSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizA]);
    vi.mocked(findProductById).mockImplementation(async (id) => {
      if (id === prodId1) return fakeProduct1;
      if (id === prodId2) return fakeProduct2;
      return null;
    });
    vi.mocked(getCurrentTaxRate).mockResolvedValue(fakeTaxRate);
    vi.mocked(insertSaleSession).mockResolvedValue(fakeSession);
    vi.mocked(insertSaleSessionItems).mockResolvedValue([]);
    vi.mocked(insertSaleSessionDiscounts).mockResolvedValue([]);
    vi.mocked(insertProductSale).mockResolvedValue({} as never);
    vi.mocked(updateProduct).mockResolvedValue(fakeProduct1);
  });

  it("business_admin は担当事業でレジ販売を登録できる", async () => {
    const result = await createSaleSession(baProfile, {
      business_id: bizA,
      payment_method: "cash",
      items: [{ product_id: prodId1, quantity: 2 }],
    });

    expect(result.ok).toBe(true);
    expect(insertSaleSession).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: bizA,
        payment_method: "cash",
        tax_rate_percent: 10,
        subtotal_amount: 1000,
        tax_amount: 100,
        total_amount: 1100,
      }),
    );
    expect(insertSaleSessionItems).toHaveBeenCalledWith([
      expect.objectContaining({
        sale_session_id: sessionId,
        product_id: prodId1,
        quantity: 2,
        unit_price: 500,
        subtotal: 1000,
      }),
    ]);
    expect(insertProductSale).toHaveBeenCalledWith(
      expect.objectContaining({
        sale_session_id: sessionId,
        product_id: prodId1,
        quantity: 2,
      }),
    );
    expect(updateProduct).toHaveBeenCalledWith(prodId1, { stock_quantity: 8 });
  });

  it("複数商品をまとめて登録できる", async () => {
    const result = await createSaleSession(baProfile, {
      business_id: bizA,
      payment_method: "cash",
      items: [
        { product_id: prodId1, quantity: 1 },
        { product_id: prodId2, quantity: 2 },
      ],
    });

    expect(result.ok).toBe(true);
    expect(insertSaleSessionItems).toHaveBeenCalledWith([
      expect.objectContaining({ product_id: prodId1, quantity: 1 }),
      expect.objectContaining({ product_id: prodId2, quantity: 2 }),
    ]);
    expect(insertProductSale).toHaveBeenCalledTimes(2);
  });

  it("admin は任意の事業でレジ販売を登録できる", async () => {
    vi.mocked(findProductById).mockResolvedValue({ ...fakeProduct1, business_id: bizB });
    const result = await createSaleSession(adminProfile, {
      business_id: bizB,
      payment_method: "stripe",
      items: [{ product_id: prodId1, quantity: 1 }],
    });

    expect(result.ok).toBe(true);
    expect(findAssignedBusinessIdsByUserId).not.toHaveBeenCalled();
  });

  it("user ロールは販売登録できない", async () => {
    const result = await createSaleSession(userProfile, {
      business_id: bizA,
      payment_method: "cash",
      items: [{ product_id: prodId1, quantity: 1 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
    expect(insertSaleSession).not.toHaveBeenCalled();
  });

  it("business_admin は担当外事業では登録できない", async () => {
    const result = await createSaleSession(baProfile, {
      business_id: bizB,
      payment_method: "cash",
      items: [{ product_id: prodId1, quantity: 1 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("カートが空の場合は400を返す", async () => {
    const result = await createSaleSession(baProfile, {
      business_id: bizA,
      payment_method: "cash",
      items: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("在庫不足の商品があるとエラーを返す", async () => {
    vi.mocked(findProductById).mockResolvedValue({ ...fakeProduct1, stock_quantity: 1 });

    const result = await createSaleSession(baProfile, {
      business_id: bizA,
      payment_method: "cash",
      items: [{ product_id: prodId1, quantity: 5 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("在庫が不足");
    }
    expect(insertSaleSession).not.toHaveBeenCalled();
  });

  it("在庫0の商品はエラーを返す", async () => {
    vi.mocked(findProductById).mockResolvedValue({ ...fakeProduct1, stock_quantity: 0 });

    const result = await createSaleSession(baProfile, {
      business_id: bizA,
      payment_method: "cash",
      items: [{ product_id: prodId1, quantity: 1 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("販売中でない商品はエラーを返す", async () => {
    vi.mocked(findProductById).mockResolvedValue({ ...fakeProduct1, status: "off_sale" as const });

    const result = await createSaleSession(baProfile, {
      business_id: bizA,
      payment_method: "cash",
      items: [{ product_id: prodId1, quantity: 1 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("販売中ではありません");
    }
  });

  it("存在しない商品はエラーを返す（404）", async () => {
    vi.mocked(findProductById).mockResolvedValue(null);

    const result = await createSaleSession(baProfile, {
      business_id: bizA,
      payment_method: "cash",
      items: [{ product_id: prodId1, quantity: 1 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("在庫なし（null）の商品はデクリメントしない", async () => {
    vi.mocked(findProductById).mockResolvedValue({ ...fakeProduct1, stock_quantity: null });

    const result = await createSaleSession(baProfile, {
      business_id: bizA,
      payment_method: "cash",
      items: [{ product_id: prodId1, quantity: 3 }],
    });

    expect(result.ok).toBe(true);
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it("成功時に payment_ledger へ pos エントリを記録する", async () => {
    const result = await createSaleSession(baProfile, {
      business_id: bizA,
      payment_method: "cash",
      items: [{ product_id: prodId1, quantity: 2 }],
    });

    expect(result.ok).toBe(true);
    expect(recordPaymentLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: bizA,
        source_type: "pos",
        source_id: sessionId,
        amount: 1100,
        payment_method: "cash",
        status: "succeeded",
      }),
    );
  });

  it("qr 支払いは payment_ledger に other として記録される", async () => {
    vi.mocked(insertSaleSession).mockResolvedValue({ ...fakeSession, payment_method: "qr" });

    await createSaleSession(baProfile, {
      business_id: bizA,
      payment_method: "qr",
      items: [{ product_id: prodId1, quantity: 1 }],
    });

    expect(recordPaymentLedger).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: "other" }),
    );
  });

  it("payment_ledger 書き込みが失敗するとセッション作成も失敗し、ロールバックを試みる", async () => {
    vi.mocked(recordPaymentLedger).mockRejectedValueOnce(new Error("ledger error"));

    const result = await createSaleSession(baProfile, {
      business_id: bizA,
      payment_method: "cash",
      items: [{ product_id: prodId1, quantity: 1 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(500);

    // ロールバック: product_sales 削除 → 在庫復元 → session 削除
    expect(deleteProductSalesBySessionId).toHaveBeenCalledWith(sessionId);
    expect(updateProduct).toHaveBeenCalledWith(prodId1, { stock_quantity: 10 });
    expect(deleteSaleSessionById).toHaveBeenCalledWith(sessionId);
  });
});

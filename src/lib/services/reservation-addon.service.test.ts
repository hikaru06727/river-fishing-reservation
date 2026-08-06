import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findProductsByIdsMock,
  decrementProductStockAdminMock,
  incrementProductStockAdminMock,
  createReservationAddonItemsMock,
  findActiveAddonItemsByReservationIdAdminMock,
  markAddonItemsStockDecrementedAdminMock,
  cancelAddonItemsForReservationAdminMock,
  findBySourceAdminMock,
  recordPaymentLedgerAdminMock,
  updatePaymentLedgerStatusAdminMock,
} = vi.hoisted(() => ({
  findProductsByIdsMock: vi.fn(),
  decrementProductStockAdminMock: vi.fn(),
  incrementProductStockAdminMock: vi.fn(),
  createReservationAddonItemsMock: vi.fn(),
  findActiveAddonItemsByReservationIdAdminMock: vi.fn(),
  markAddonItemsStockDecrementedAdminMock: vi.fn(),
  cancelAddonItemsForReservationAdminMock: vi.fn(),
  findBySourceAdminMock: vi.fn(),
  recordPaymentLedgerAdminMock: vi.fn(),
  updatePaymentLedgerStatusAdminMock: vi.fn(),
}));

vi.mock("@/lib/repositories/products.repository", () => ({
  findProductsByIds: findProductsByIdsMock,
  decrementProductStockAdmin: decrementProductStockAdminMock,
  incrementProductStockAdmin: incrementProductStockAdminMock,
}));

vi.mock("@/lib/repositories/reservation-addon-items.repository", () => ({
  createReservationAddonItems: createReservationAddonItemsMock,
  findActiveAddonItemsByReservationIdAdmin: findActiveAddonItemsByReservationIdAdminMock,
  markAddonItemsStockDecrementedAdmin: markAddonItemsStockDecrementedAdminMock,
  cancelAddonItemsForReservationAdmin: cancelAddonItemsForReservationAdminMock,
}));

vi.mock("@/lib/repositories/payment-ledger.repository", () => ({
  findBySourceAdmin: findBySourceAdminMock,
  recordPaymentLedgerAdmin: recordPaymentLedgerAdminMock,
  updatePaymentLedgerStatusAdmin: updatePaymentLedgerStatusAdminMock,
}));

import {
  cancelAddonItemsAndRestoreStock,
  confirmAddonPaymentAndStock,
  createAddonItemsForReservation,
  getActiveAddonAmountSummary,
} from "@/lib/services/reservation-addon.service";

function product(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "prod-1",
    business_id: "biz-1",
    name: "テスト商品",
    price_excluding_tax: 1000,
    default_tax_rate: 10,
    image_url: null,
    track_inventory: false,
    stock_quantity: null,
    description_online: null,
    shippable: true,
    ...overrides,
  };
}

beforeEach(() => {
  findProductsByIdsMock.mockReset();
  decrementProductStockAdminMock.mockReset();
  incrementProductStockAdminMock.mockReset();
  createReservationAddonItemsMock.mockReset();
  findActiveAddonItemsByReservationIdAdminMock.mockReset();
  markAddonItemsStockDecrementedAdminMock.mockReset();
  cancelAddonItemsForReservationAdminMock.mockReset();
  findBySourceAdminMock.mockReset();
  recordPaymentLedgerAdminMock.mockReset();
  updatePaymentLedgerStatusAdminMock.mockReset();
});

describe("createAddonItemsForReservation", () => {
  it("在庫不足の商品が含まれる場合はエラーを返す", async () => {
    findProductsByIdsMock.mockResolvedValue([
      product({ track_inventory: true, stock_quantity: 1 }),
    ]);

    const result = await createAddonItemsForReservation("res-1", "biz-1", [
      { productId: "prod-1", quantity: 2 },
    ]);

    expect(result.ok).toBe(false);
    expect(createReservationAddonItemsMock).not.toHaveBeenCalled();
  });

  it("公開されていない商品IDが含まれる場合はエラーを返す", async () => {
    findProductsByIdsMock.mockResolvedValue([]);

    const result = await createAddonItemsForReservation("res-1", "biz-1", [
      { productId: "prod-missing", quantity: 1 },
    ]);

    expect(result.ok).toBe(false);
  });

  it("検証を通過した明細のみ登録し、税込合計を返す", async () => {
    findProductsByIdsMock.mockResolvedValue([product()]);
    createReservationAddonItemsMock.mockResolvedValue([
      {
        id: "item-1",
        reservation_id: "res-1",
        product_id: "prod-1",
        product_name: "テスト商品",
        unit_price: 1000,
        tax_rate: 10,
        quantity: 2,
        status: "active",
        stock_decremented_at: null,
        created_at: "",
        updated_at: "",
      },
    ]);

    const result = await createAddonItemsForReservation("res-1", "biz-1", [
      { productId: "prod-1", quantity: 2 },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // net=2000, tax=floor(2000*0.1)=200, total=2200
      expect(result.data.summary).toEqual({
        subtotalAmount: 2000,
        taxAmount: 200,
        totalAmount: 2200,
      });
    }
  });

  it("アドオンが空の場合は登録をスキップする", async () => {
    const result = await createAddonItemsForReservation("res-1", "biz-1", []);

    expect(result.ok).toBe(true);
    expect(findProductsByIdsMock).not.toHaveBeenCalled();
    expect(createReservationAddonItemsMock).not.toHaveBeenCalled();
  });
});

describe("confirmAddonPaymentAndStock", () => {
  it("未引当の明細のみ在庫を decrement し、reservation_addon の payment_ledger を記録する", async () => {
    const newlyDecremented = [
      { id: "item-1", product_id: "prod-1", quantity: 2, unit_price: 1000, tax_rate: 10 },
    ];
    markAddonItemsStockDecrementedAdminMock.mockResolvedValue(newlyDecremented);
    findActiveAddonItemsByReservationIdAdminMock.mockResolvedValue(newlyDecremented);

    await confirmAddonPaymentAndStock({
      reservationId: "res-1",
      businessId: "biz-1",
      paymentMethod: "card",
      paidAtIso: "2026-01-01T00:00:00.000Z",
    });

    expect(decrementProductStockAdminMock).toHaveBeenCalledWith("prod-1", 2);
    expect(recordPaymentLedgerAdminMock).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: "biz-1",
        source_type: "reservation_addon",
        source_id: "res-1",
        amount: 2200,
        payment_method: "card",
        status: "succeeded",
      }),
    );
  });

  it("再呼び出し（冪等）では既に引当済みの明細を再度 decrement しない", async () => {
    markAddonItemsStockDecrementedAdminMock.mockResolvedValue([]);
    findActiveAddonItemsByReservationIdAdminMock.mockResolvedValue([
      { id: "item-1", product_id: "prod-1", quantity: 2, unit_price: 1000, tax_rate: 10 },
    ]);

    await confirmAddonPaymentAndStock({
      reservationId: "res-1",
      businessId: "biz-1",
      paymentMethod: "card",
      paidAtIso: "2026-01-01T00:00:00.000Z",
    });

    expect(decrementProductStockAdminMock).not.toHaveBeenCalled();
    // 既存のアクティブ明細がある限り ledger の upsert は毎回行われる（冪等な upsert のため問題ない）
    expect(recordPaymentLedgerAdminMock).toHaveBeenCalled();
  });

  it("有効なアドオン明細が存在しない場合は payment_ledger を記録しない", async () => {
    markAddonItemsStockDecrementedAdminMock.mockResolvedValue([]);
    findActiveAddonItemsByReservationIdAdminMock.mockResolvedValue([]);

    await confirmAddonPaymentAndStock({
      reservationId: "res-1",
      businessId: "biz-1",
      paymentMethod: "cash",
      paidAtIso: "2026-01-01T00:00:00.000Z",
    });

    expect(recordPaymentLedgerAdminMock).not.toHaveBeenCalled();
  });
});

describe("cancelAddonItemsAndRestoreStock", () => {
  it("在庫引当済みの明細のみ在庫を復元する", async () => {
    cancelAddonItemsForReservationAdminMock.mockResolvedValue([
      { id: "item-1", product_id: "prod-1", quantity: 2, stock_decremented_at: "2026-01-01" },
      { id: "item-2", product_id: "prod-2", quantity: 1, stock_decremented_at: null },
    ]);
    findBySourceAdminMock.mockResolvedValue(null);

    await cancelAddonItemsAndRestoreStock("res-1");

    expect(incrementProductStockAdminMock).toHaveBeenCalledTimes(1);
    expect(incrementProductStockAdminMock).toHaveBeenCalledWith("prod-1", 2);
  });

  it("succeeded な reservation_addon の payment_ledger 行を refunded に更新する", async () => {
    cancelAddonItemsForReservationAdminMock.mockResolvedValue([]);
    findBySourceAdminMock.mockResolvedValue({ id: "ledger-1", status: "succeeded" });

    await cancelAddonItemsAndRestoreStock("res-1");

    expect(updatePaymentLedgerStatusAdminMock).toHaveBeenCalledWith("ledger-1", "refunded");
  });

  it("pending な payment_ledger 行は更新しない（未精算はそもそも記録されない想定）", async () => {
    cancelAddonItemsForReservationAdminMock.mockResolvedValue([]);
    findBySourceAdminMock.mockResolvedValue({ id: "ledger-1", status: "pending" });

    await cancelAddonItemsAndRestoreStock("res-1");

    expect(updatePaymentLedgerStatusAdminMock).not.toHaveBeenCalled();
  });
});

describe("getActiveAddonAmountSummary", () => {
  it("有効な明細の税抜・税・税込を合算する", async () => {
    findActiveAddonItemsByReservationIdAdminMock.mockResolvedValue([
      { unit_price: 1000, tax_rate: 10, quantity: 2 },
      { unit_price: 500, tax_rate: 8, quantity: 1 },
    ]);

    const summary = await getActiveAddonAmountSummary("res-1");

    // item1: net=2000, tax=200 / item2: net=500, tax=40
    expect(summary).toEqual({ subtotalAmount: 2500, taxAmount: 240, totalAmount: 2740 });
  });
});

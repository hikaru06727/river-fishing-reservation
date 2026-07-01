import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findActiveBusinessBySlugMock,
  findProductsByIdsMock,
  createOnlineOrderMock,
  createOnlineOrderItemsMock,
} = vi.hoisted(() => ({
  findActiveBusinessBySlugMock: vi.fn(),
  findProductsByIdsMock: vi.fn(),
  createOnlineOrderMock: vi.fn(),
  createOnlineOrderItemsMock: vi.fn(),
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findActiveBusinessBySlug: findActiveBusinessBySlugMock,
}));

vi.mock("@/lib/repositories/products.repository", () => ({
  findProductsByIds: findProductsByIdsMock,
  decrementProductStockAdmin: vi.fn(),
}));

vi.mock("@/lib/repositories/online-order.repository", () => ({
  createOnlineOrder: createOnlineOrderMock,
  createOnlineOrderItems: createOnlineOrderItemsMock,
  findOnlineOrderById: vi.fn(),
  findOnlineOrderByStripeSessionId: vi.fn(),
  findOnlineOrderItemsByOrderId: vi.fn(),
  updateOnlineOrderPaymentStatus: vi.fn(),
  updateOnlineOrderStatus: vi.fn(),
  updateOnlineOrderStripeSession: vi.fn(),
}));

vi.mock("@/lib/repositories/payment-ledger.repository", () => ({
  recordPaymentLedgerAdmin: vi.fn(),
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripe: vi.fn(),
}));

import { createOrder } from "./online-order.service";

const BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
const SLUG = "test-shop";

const BASE_PRODUCT = {
  id: "product-1",
  business_id: BUSINESS_ID,
  name: "天然餌セット",
  price_excluding_tax: 1000,
  default_tax_rate: 10,
  image_url: null,
  track_inventory: false,
  stock_quantity: null,
  description_online: null,
  shippable: true,
};

function baseInput(overrides: Partial<Parameters<typeof createOrder>[0]> = {}) {
  return {
    businessId: BUSINESS_ID,
    slug: SLUG,
    items: [{ productId: "product-1", quantity: 2 }],
    fulfillmentType: "pickup" as const,
    paymentMethod: "in_person" as const,
    customerName: "山田太郎",
    customerEmail: "taro@example.com",
    ...overrides,
  };
}

describe("createOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findActiveBusinessBySlugMock.mockResolvedValue({ id: BUSINESS_ID, name: "Test Shop", slug: SLUG });
  });

  it("在庫あり商品の注文作成が成功する", async () => {
    findProductsByIdsMock.mockResolvedValue([{ ...BASE_PRODUCT, track_inventory: true, stock_quantity: 10 }]);
    createOnlineOrderMock.mockResolvedValue({ id: "order-1", status: "pending_payment" });
    createOnlineOrderItemsMock.mockResolvedValue([{ id: "item-1" }]);

    const result = await createOrder(baseInput());

    expect(result.ok).toBe(true);
    expect(createOnlineOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal_amount: 2000,
        tax_amount: 200,
        total_amount: 2200,
      }),
    );
  });

  it("track_inventory=true で stock_quantity=0 の商品を含む注文がエラーになる", async () => {
    findProductsByIdsMock.mockResolvedValue([{ ...BASE_PRODUCT, track_inventory: true, stock_quantity: 0 }]);

    const result = await createOrder(baseInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("在庫");
    expect(createOnlineOrderMock).not.toHaveBeenCalled();
  });

  it("配送不可商品（shippable=false）で fulfillmentType='shipping' の注文がエラーになる", async () => {
    findProductsByIdsMock.mockResolvedValue([{ ...BASE_PRODUCT, shippable: false }]);

    const result = await createOrder(
      baseInput({
        fulfillmentType: "shipping",
        shippingAddress: {
          postalCode: "100-0001",
          prefecture: "東京都",
          addressLine1: "千代田1-1",
        },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("配送");
    expect(createOnlineOrderMock).not.toHaveBeenCalled();
  });

  it("payment_method='in_person' の場合に status='pending_payment' で保存される", async () => {
    findProductsByIdsMock.mockResolvedValue([BASE_PRODUCT]);
    createOnlineOrderMock.mockResolvedValue({ id: "order-1", status: "pending_payment" });
    createOnlineOrderItemsMock.mockResolvedValue([]);

    const result = await createOrder(baseInput({ paymentMethod: "in_person" }));

    expect(result.ok).toBe(true);
    expect(createOnlineOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: "in_person" }),
    );
    // status は repository 側のデフォルト（pending_payment）に委ねるため明示的には渡さない
    const insertArg = createOnlineOrderMock.mock.calls[0][0];
    expect(insertArg.status).toBeUndefined();
  });

  it("カートが空の場合はエラーになる", async () => {
    const result = await createOrder(baseInput({ items: [] }));
    expect(result.ok).toBe(false);
    expect(findActiveBusinessBySlugMock).not.toHaveBeenCalled();
  });

  it("存在しない・非公開の商品が含まれる場合はエラーになる", async () => {
    findProductsByIdsMock.mockResolvedValue([]);

    const result = await createOrder(baseInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("購入できない");
  });
});

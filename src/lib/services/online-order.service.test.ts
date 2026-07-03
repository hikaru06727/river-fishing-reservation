import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findActiveBusinessBySlugMock,
  findAssignedBusinessIdsByUserIdMock,
  findAssignedBusinessIdsByStaffUserIdMock,
  findProductsByIdsMock,
  decrementProductStockAdminMock,
  createOnlineOrderMock,
  createOnlineOrderItemsMock,
  findOnlineOrderByIdForAdminMock,
  findOnlineOrderItemsByOrderIdMock,
  findOnlineOrdersByBusinessMock,
  updateOnlineOrderPaymentStatusMock,
  updateOnlineOrderStatusMock,
  recordPaymentLedgerAdminMock,
} = vi.hoisted(() => ({
  findActiveBusinessBySlugMock: vi.fn(),
  findAssignedBusinessIdsByUserIdMock: vi.fn(),
  findAssignedBusinessIdsByStaffUserIdMock: vi.fn(),
  findProductsByIdsMock: vi.fn(),
  decrementProductStockAdminMock: vi.fn(),
  createOnlineOrderMock: vi.fn(),
  createOnlineOrderItemsMock: vi.fn(),
  findOnlineOrderByIdForAdminMock: vi.fn(),
  findOnlineOrderItemsByOrderIdMock: vi.fn(),
  findOnlineOrdersByBusinessMock: vi.fn(),
  updateOnlineOrderPaymentStatusMock: vi.fn(),
  updateOnlineOrderStatusMock: vi.fn(),
  recordPaymentLedgerAdminMock: vi.fn(),
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findActiveBusinessBySlug: findActiveBusinessBySlugMock,
  findAssignedBusinessIdsByUserId: findAssignedBusinessIdsByUserIdMock,
}));

vi.mock("@/lib/repositories/staff-members.repository", () => ({
  findAssignedBusinessIdsByStaffUserId: findAssignedBusinessIdsByStaffUserIdMock,
}));

vi.mock("@/lib/repositories/products.repository", () => ({
  findProductsByIds: findProductsByIdsMock,
  decrementProductStockAdmin: decrementProductStockAdminMock,
}));

vi.mock("@/lib/repositories/online-order.repository", () => ({
  createOnlineOrder: createOnlineOrderMock,
  createOnlineOrderItems: createOnlineOrderItemsMock,
  findOnlineOrderById: vi.fn(),
  findOnlineOrderByIdForAdmin: findOnlineOrderByIdForAdminMock,
  findOnlineOrderByStripeSessionId: vi.fn(),
  findOnlineOrderItemsByOrderId: findOnlineOrderItemsByOrderIdMock,
  findOnlineOrdersByBusiness: findOnlineOrdersByBusinessMock,
  updateOnlineOrderPaymentStatus: updateOnlineOrderPaymentStatusMock,
  updateOnlineOrderStatus: updateOnlineOrderStatusMock,
  updateOnlineOrderStripeSession: vi.fn(),
}));

vi.mock("@/lib/repositories/payment-ledger.repository", () => ({
  recordPaymentLedgerAdmin: recordPaymentLedgerAdminMock,
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripe: vi.fn(),
}));

import {
  advanceOnlineOrderStatus,
  confirmInPersonOrderPickup,
  createOrder,
  getNextOnlineOrderStatus,
  getOnlineOrderDetailForAdmin,
  getOnlineOrdersForBusiness,
} from "./online-order.service";

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

const ADMIN_PROFILE = { id: "admin-1", role: "admin" } as const;
const BUSINESS_ADMIN_PROFILE = { id: "biz-admin-1", role: "business_admin" } as const;
const STAFF_PROFILE = { id: "staff-1", role: "staff" } as const;

const SAMPLE_ORDER = {
  id: "order-1",
  business_id: BUSINESS_ID,
  status: "preparing" as const,
  fulfillment_type: "pickup" as const,
  payment_method: "in_person" as const,
  payment_status: "pending" as const,
  total_amount: 2200,
};

describe("getNextOnlineOrderStatus", () => {
  it("pickup フローで次のステータスを返す", () => {
    expect(getNextOnlineOrderStatus("pending_payment", "pickup")).toBe("paid");
    expect(getNextOnlineOrderStatus("preparing", "pickup")).toBe("ready");
    expect(getNextOnlineOrderStatus("ready", "pickup")).toBe("delivered");
  });

  it("shipping フローで次のステータスを返す", () => {
    expect(getNextOnlineOrderStatus("preparing", "shipping")).toBe("shipped");
    expect(getNextOnlineOrderStatus("shipped", "shipping")).toBe("delivered");
  });

  it("最終ステータスの場合は null を返す", () => {
    expect(getNextOnlineOrderStatus("delivered", "pickup")).toBeNull();
  });
});

describe("getOnlineOrdersForBusiness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin は担当事業チェックなしで注文一覧を取得できる", async () => {
    findOnlineOrdersByBusinessMock.mockResolvedValue([SAMPLE_ORDER]);

    const result = await getOnlineOrdersForBusiness(ADMIN_PROFILE, BUSINESS_ID);

    expect(result.ok).toBe(true);
    expect(findAssignedBusinessIdsByUserIdMock).not.toHaveBeenCalled();
  });

  it("business_admin が担当外の事業を指定するとエラーになる", async () => {
    findAssignedBusinessIdsByUserIdMock.mockResolvedValue(["other-business"]);

    const result = await getOnlineOrdersForBusiness(BUSINESS_ADMIN_PROFILE, BUSINESS_ID);

    expect(result.ok).toBe(false);
    expect(findOnlineOrdersByBusinessMock).not.toHaveBeenCalled();
  });
});

describe("getOnlineOrderDetailForAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("注文が見つからない場合は null を返す", async () => {
    findOnlineOrderByIdForAdminMock.mockResolvedValue(null);

    const result = await getOnlineOrderDetailForAdmin("order-1");

    expect(result).toBeNull();
  });

  it("注文と明細を返す", async () => {
    findOnlineOrderByIdForAdminMock.mockResolvedValue(SAMPLE_ORDER);
    findOnlineOrderItemsByOrderIdMock.mockResolvedValue([{ id: "item-1" }]);

    const result = await getOnlineOrderDetailForAdmin("order-1");

    expect(result).toEqual({ order: SAMPLE_ORDER, items: [{ id: "item-1" }] });
  });
});

describe("advanceOnlineOrderStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("staff は権限がないためエラーになる", async () => {
    const result = await advanceOnlineOrderStatus(STAFF_PROFILE, "order-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
    expect(findOnlineOrderByIdForAdminMock).not.toHaveBeenCalled();
  });

  it("business_admin が次のステータスに進められる", async () => {
    findOnlineOrderByIdForAdminMock.mockResolvedValue(SAMPLE_ORDER);
    findAssignedBusinessIdsByUserIdMock.mockResolvedValue([BUSINESS_ID]);

    const result = await advanceOnlineOrderStatus(BUSINESS_ADMIN_PROFILE, "order-1");

    expect(result.ok).toBe(true);
    expect(updateOnlineOrderStatusMock).toHaveBeenCalledWith("order-1", "ready");
  });

  it("担当外の事業の注文は操作できない", async () => {
    findOnlineOrderByIdForAdminMock.mockResolvedValue(SAMPLE_ORDER);
    findAssignedBusinessIdsByUserIdMock.mockResolvedValue(["other-business"]);

    const result = await advanceOnlineOrderStatus(BUSINESS_ADMIN_PROFILE, "order-1");

    expect(result.ok).toBe(false);
    expect(updateOnlineOrderStatusMock).not.toHaveBeenCalled();
  });

  it("最終ステータスの注文は進められない", async () => {
    findOnlineOrderByIdForAdminMock.mockResolvedValue({ ...SAMPLE_ORDER, status: "delivered" });

    const result = await advanceOnlineOrderStatus(ADMIN_PROFILE, "order-1");

    expect(result.ok).toBe(false);
    expect(updateOnlineOrderStatusMock).not.toHaveBeenCalled();
  });
});

describe("confirmInPersonOrderPickup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("staff は権限がないためエラーになる", async () => {
    const result = await confirmInPersonOrderPickup(STAFF_PROFILE, "order-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("在庫を減算し、支払い・ステータス・売上を記録する", async () => {
    findOnlineOrderByIdForAdminMock.mockResolvedValue(SAMPLE_ORDER);
    findOnlineOrderItemsByOrderIdMock.mockResolvedValue([
      { product_id: "product-1", quantity: 2 },
    ]);

    const result = await confirmInPersonOrderPickup(ADMIN_PROFILE, "order-1");

    expect(result.ok).toBe(true);
    expect(decrementProductStockAdminMock).toHaveBeenCalledWith("product-1", 2);
    expect(updateOnlineOrderPaymentStatusMock).toHaveBeenCalledWith("order-1", "paid");
    expect(updateOnlineOrderStatusMock).toHaveBeenCalledWith("order-1", "delivered");
    expect(recordPaymentLedgerAdminMock).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: "cash", source_type: "online_order" }),
    );
  });

  it("stripe 決済の注文はエラーになる", async () => {
    findOnlineOrderByIdForAdminMock.mockResolvedValue({ ...SAMPLE_ORDER, payment_method: "stripe" });

    const result = await confirmInPersonOrderPickup(ADMIN_PROFILE, "order-1");

    expect(result.ok).toBe(false);
    expect(updateOnlineOrderStatusMock).not.toHaveBeenCalled();
  });

  it("すでに支払い済みの注文は二重に在庫減算されない", async () => {
    findOnlineOrderByIdForAdminMock.mockResolvedValue({ ...SAMPLE_ORDER, payment_status: "paid" });

    const result = await confirmInPersonOrderPickup(ADMIN_PROFILE, "order-1");

    expect(result.ok).toBe(false);
    expect(decrementProductStockAdminMock).not.toHaveBeenCalled();
  });
});

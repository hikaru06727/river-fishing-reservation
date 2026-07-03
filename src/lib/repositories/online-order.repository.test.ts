import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createOnlineOrder,
  createOnlineOrderItems,
  findExpiredPickupOrders,
  findOnlineOrderBusinessId,
  findOnlineOrderByIdForAdmin,
  findOnlineOrdersByBusiness,
  findOrdersByPickupDate,
  updateOnlineOrderStatus,
} from "./online-order.repository";

const SAMPLE_ORDER = {
  id: "order-1",
  business_id: "biz-1",
  status: "pending_payment",
  fulfillment_type: "pickup",
  payment_method: "in_person",
  payment_status: "pending",
  stripe_checkout_session_id: null,
  subtotal_amount: 2000,
  tax_amount: 200,
  total_amount: 2200,
  customer_name: "山田太郎",
  customer_email: "taro@example.com",
  customer_phone: null,
  shipping_postal_code: null,
  shipping_prefecture: null,
  shipping_address_line1: null,
  shipping_address_line2: null,
  notes: null,
  created_at: "2026-06-24T00:00:00Z",
  updated_at: "2026-06-24T00:00:00Z",
};

describe("createOnlineOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("注文を作成して結果を返す", async () => {
    const single = vi.fn().mockResolvedValue({ data: SAMPLE_ORDER, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    vi.mocked(createAdminClient).mockReturnValue({ from } as any);

    const result = await createOnlineOrder({
      business_id: "biz-1",
      fulfillment_type: "pickup",
      payment_method: "in_person",
      subtotal_amount: 2000,
      tax_amount: 200,
      total_amount: 2200,
      customer_name: "山田太郎",
      customer_email: "taro@example.com",
    });

    expect(result).toEqual(SAMPLE_ORDER);
    expect(from).toHaveBeenCalledWith("online_orders");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ business_id: "biz-1", total_amount: 2200 }),
    );
  });

  it("DBエラー時は例外をスロー", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    vi.mocked(createAdminClient).mockReturnValue({ from } as any);

    await expect(
      createOnlineOrder({
        business_id: "biz-1",
        fulfillment_type: "pickup",
        payment_method: "in_person",
        subtotal_amount: 2000,
        tax_amount: 200,
        total_amount: 2200,
        customer_name: "山田太郎",
        customer_email: "taro@example.com",
      }),
    ).rejects.toThrow("DB error");
  });

  it("6桁の確認コードを生成してinsertする", async () => {
    const single = vi.fn().mockResolvedValue({ data: SAMPLE_ORDER, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    vi.mocked(createAdminClient).mockReturnValue({ from } as any);

    await createOnlineOrder({
      business_id: "biz-1",
      fulfillment_type: "pickup",
      payment_method: "in_person",
      subtotal_amount: 2000,
      tax_amount: 200,
      total_amount: 2200,
      customer_name: "山田太郎",
      customer_email: "taro@example.com",
    });

    const insertArg = insert.mock.calls[0][0];
    expect(insertArg.confirmation_code).toMatch(/^\d{6}$/);
    expect(insertArg.pickup_deadline).toBeNull();
  });

  it("pickup_date指定時はpickup_deadline（+3日）を算出してinsertする", async () => {
    const single = vi.fn().mockResolvedValue({ data: SAMPLE_ORDER, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    vi.mocked(createAdminClient).mockReturnValue({ from } as any);

    await createOnlineOrder({
      business_id: "biz-1",
      fulfillment_type: "pickup",
      payment_method: "in_person",
      subtotal_amount: 2000,
      tax_amount: 200,
      total_amount: 2200,
      customer_name: "山田太郎",
      customer_email: "taro@example.com",
      pickup_date: "2025-08-02T01:00:00.000Z",
    });

    const insertArg = insert.mock.calls[0][0];
    expect(insertArg.pickup_date).toBe("2025-08-02T01:00:00.000Z");
    expect(insertArg.pickup_deadline).toBe("2025-08-05T01:00:00.000Z");
  });
});

describe("createOnlineOrderItems", () => {
  beforeEach(() => vi.clearAllMocks());

  it("空配列の場合は DB を呼ばずに空配列を返す", async () => {
    const from = vi.fn();
    vi.mocked(createAdminClient).mockReturnValue({ from } as any);

    const result = await createOnlineOrderItems([]);

    expect(result).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("複数明細を作成して結果を返す", async () => {
    const items = [{ id: "item-1" }, { id: "item-2" }];
    const select = vi.fn().mockResolvedValue({ data: items, error: null });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    vi.mocked(createAdminClient).mockReturnValue({ from } as any);

    const result = await createOnlineOrderItems([
      {
        order_id: "order-1",
        product_id: "product-1",
        product_name: "天然餌セット",
        unit_price: 1000,
        tax_rate: 10,
        quantity: 2,
      },
    ]);

    expect(result).toEqual(items);
    expect(from).toHaveBeenCalledWith("online_order_items");
  });
});

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

describe("findOnlineOrdersByBusiness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("business_id で絞り込んだ注文一覧を返す", async () => {
    const orders = [{ id: "order-1" }];
    const builder = makeQueryBuilder({ data: orders, error: null });
    const select = vi.fn().mockReturnValue(builder);
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createClient).mockResolvedValue({ from } as any);

    const result = await findOnlineOrdersByBusiness("biz-1");

    expect(result).toEqual(orders);
    expect(from).toHaveBeenCalledWith("online_orders");
    expect(builder.eq).toHaveBeenCalledWith("business_id", "biz-1");
  });

  it("フィルタ指定時は追加で eq を呼ぶ", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    const select = vi.fn().mockReturnValue(builder);
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createClient).mockResolvedValue({ from } as any);

    await findOnlineOrdersByBusiness("biz-1", {
      status: "paid",
      fulfillmentType: "pickup",
      paymentMethod: "in_person",
    });

    expect(builder.eq).toHaveBeenCalledWith("status", "paid");
    expect(builder.eq).toHaveBeenCalledWith("fulfillment_type", "pickup");
    expect(builder.eq).toHaveBeenCalledWith("payment_method", "in_person");
  });

  it("DBエラー時は例外をスロー", async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: "DB error" } });
    const select = vi.fn().mockReturnValue(builder);
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createClient).mockResolvedValue({ from } as any);

    await expect(findOnlineOrdersByBusiness("biz-1")).rejects.toThrow("DB error");
  });
});

describe("findOnlineOrderByIdForAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("RLS スコープ内の注文を返す", async () => {
    const order = { id: "order-1" };
    const maybeSingle = vi.fn().mockResolvedValue({ data: order, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createClient).mockResolvedValue({ from } as any);

    const result = await findOnlineOrderByIdForAdmin("order-1");

    expect(result).toEqual(order);
    expect(eq).toHaveBeenCalledWith("id", "order-1");
  });

  it("見つからない場合は null を返す", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createClient).mockResolvedValue({ from } as any);

    const result = await findOnlineOrderByIdForAdmin("order-1");

    expect(result).toBeNull();
  });
});

describe("findOnlineOrderBusinessId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("business_id を返す", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { business_id: "biz-1" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createClient).mockResolvedValue({ from } as any);

    const result = await findOnlineOrderBusinessId("order-1");

    expect(result).toBe("biz-1");
  });
});

describe("updateOnlineOrderStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shipped 以外は shipped_at を含めずに更新する", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });

    vi.mocked(createAdminClient).mockReturnValue({ from } as any);

    await updateOnlineOrderStatus("order-1", "preparing");

    expect(update).toHaveBeenCalledWith({ status: "preparing" });
  });

  it("delivered のときは delivered_at を記録し shipped_at は含めない", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });

    vi.mocked(createAdminClient).mockReturnValue({ from } as any);

    await updateOnlineOrderStatus("order-1", "delivered");

    const updateArg = update.mock.calls[0][0];
    expect(updateArg.status).toBe("delivered");
    expect(typeof updateArg.delivered_at).toBe("string");
    expect(updateArg.shipped_at).toBeUndefined();
  });

  it("shipped のときは shipped_at を記録する", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });

    vi.mocked(createAdminClient).mockReturnValue({ from } as any);

    await updateOnlineOrderStatus("order-1", "shipped");

    const updateArg = update.mock.calls[0][0];
    expect(updateArg.status).toBe("shipped");
    expect(typeof updateArg.shipped_at).toBe("string");
  });
});

describe("findOrdersByPickupDate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("当日のpickup_dateで絞り込み、cancelled/deliveredを除外する", async () => {
    const orders = [
      { id: "order-1", status: "preparing" },
      { id: "order-2", status: "cancelled" },
      { id: "order-3", status: "delivered" },
    ];
    const builder = makeQueryBuilder({ data: orders, error: null });
    const select = vi.fn().mockReturnValue(builder);
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createClient).mockResolvedValue({ from } as any);

    const result = await findOrdersByPickupDate("biz-1", new Date("2025-08-02T10:00:00+09:00"));

    expect(result).toEqual([{ id: "order-1", status: "preparing" }]);
    expect(from).toHaveBeenCalledWith("online_orders");
    expect(builder.eq).toHaveBeenCalledWith("business_id", "biz-1");
  });
});

describe("findExpiredPickupOrders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("受け取り期限切れ・対象ステータスの注文を返す", async () => {
    const orders = [{ id: "order-1" }];
    const inFn = vi.fn().mockResolvedValue({ data: orders, error: null });
    const lt = vi.fn().mockReturnValue({ in: inFn });
    const select = vi.fn().mockReturnValue({ lt });
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createAdminClient).mockReturnValue({ from } as any);

    const result = await findExpiredPickupOrders();

    expect(result).toEqual(orders);
    expect(inFn).toHaveBeenCalledWith("status", ["paid", "preparing", "ready"]);
  });

  it("DBエラー時は例外をスロー", async () => {
    const inFn = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const lt = vi.fn().mockReturnValue({ in: inFn });
    const select = vi.fn().mockReturnValue({ lt });
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createAdminClient).mockReturnValue({ from } as any);

    await expect(findExpiredPickupOrders()).rejects.toThrow("DB error");
  });
});

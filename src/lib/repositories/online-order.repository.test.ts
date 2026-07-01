import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { createOnlineOrder, createOnlineOrderItems } from "./online-order.repository";

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

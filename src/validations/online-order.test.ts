import { describe, expect, it } from "vitest";
import { createOnlineOrderSchema } from "./online-order";
import { getPickupDateRange } from "@/lib/online-orders/pickup-schedule";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    slug: "test-shop",
    businessId: BUSINESS_ID,
    items: [{ productId: PRODUCT_ID, quantity: 1 }],
    fulfillmentType: "pickup",
    paymentMethod: "in_person",
    customerName: "山田太郎",
    customerEmail: "taro@example.com",
    ...overrides,
  };
}

describe("createOnlineOrderSchema pickup rules", () => {
  it("pickupのときpickupDate/pickupTimeが必須", () => {
    const result = createOnlineOrderSchema.safeParse(baseInput());
    expect(result.success).toBe(false);
  });

  it("有効なpickupDate/pickupTimeがあれば成功する", () => {
    const { min } = getPickupDateRange();
    const result = createOnlineOrderSchema.safeParse(
      baseInput({ pickupDate: min, pickupTime: "10:00" }),
    );
    expect(result.success).toBe(true);
  });

  it("受け取り希望日が範囲外だとエラーになる", () => {
    const result = createOnlineOrderSchema.safeParse(
      baseInput({ pickupDate: "2000-01-01", pickupTime: "10:00" }),
    );
    expect(result.success).toBe(false);
  });

  it("受け取り希望時刻が30分刻みでないとエラーになる", () => {
    const { min } = getPickupDateRange();
    const result = createOnlineOrderSchema.safeParse(
      baseInput({ pickupDate: min, pickupTime: "10:15" }),
    );
    expect(result.success).toBe(false);
  });

  it("shippingのときはpickupDate/pickupTimeが無くても成功する", () => {
    const result = createOnlineOrderSchema.safeParse(
      baseInput({
        fulfillmentType: "shipping",
        shippingAddress: {
          postalCode: "100-0001",
          prefecture: "東京都",
          addressLine1: "千代田1-1",
        },
      }),
    );
    expect(result.success).toBe(true);
  });
});

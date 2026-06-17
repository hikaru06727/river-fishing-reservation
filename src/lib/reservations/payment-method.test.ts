import { describe, expect, it } from "vitest";
import {
  getInitialReservationStatusForPaymentMethod,
  getPaymentMethodLabel,
  getPaymentStateLabel,
  inferPaymentMethod,
  shouldExpirePendingReservation,
  shouldProceedToStripeCheckout,
} from "@/lib/reservations/payment-method";

describe("inferPaymentMethod", () => {
  it("payment_method 未設定は online とみなす（後方互換）", () => {
    expect(inferPaymentMethod({})).toBe("online");
    expect(inferPaymentMethod({ payment_method: null })).toBe("online");
  });

  it("cash_at_venue を認識する", () => {
    expect(inferPaymentMethod({ payment_method: "cash_at_venue" })).toBe("cash_at_venue");
  });
});

describe("shouldProceedToStripeCheckout", () => {
  it("オンライン決済のみ Checkout 対象", () => {
    expect(shouldProceedToStripeCheckout("online")).toBe(true);
    expect(shouldProceedToStripeCheckout("cash_at_venue")).toBe(false);
  });
});

describe("shouldExpirePendingReservation", () => {
  it("オンライン pending のみ失効対象", () => {
    expect(shouldExpirePendingReservation("online", "pending")).toBe(true);
    expect(shouldExpirePendingReservation("cash_at_venue", "pending")).toBe(false);
    expect(shouldExpirePendingReservation("online", "confirmed")).toBe(false);
  });
});

describe("getInitialReservationStatusForPaymentMethod", () => {
  it("現金は confirmed、オンラインは pending", () => {
    expect(getInitialReservationStatusForPaymentMethod("cash_at_venue")).toBe("confirmed");
    expect(getInitialReservationStatusForPaymentMethod("online")).toBe("pending");
  });
});

describe("getPaymentStateLabel", () => {
  it("オンライン pending は決済待ち", () => {
    expect(
      getPaymentStateLabel({
        paymentMethod: "online",
        reservationStatus: "pending",
        paymentStatus: null,
      }),
    ).toBe("決済待ち");
  });

  it("オンライン confirmed + succeeded は決済済み", () => {
    expect(
      getPaymentStateLabel({
        paymentMethod: "online",
        reservationStatus: "confirmed",
        paymentStatus: "succeeded",
      }),
    ).toBe("決済済み");
  });

  it("現金 confirmed は当日精算予定", () => {
    expect(
      getPaymentStateLabel({
        paymentMethod: "cash_at_venue",
        reservationStatus: "confirmed",
        paymentStatus: null,
      }),
    ).toBe("当日精算予定");
  });

  it("現金 + succeeded は現地精算済", () => {
    expect(
      getPaymentStateLabel({
        paymentMethod: "cash_at_venue",
        reservationStatus: "confirmed",
        paymentStatus: "succeeded",
      }),
    ).toBe("現地精算済");
  });
});

describe("getPaymentMethodLabel", () => {
  it("現金精算ラベル", () => {
    expect(getPaymentMethodLabel("cash_at_venue")).toContain("現金");
  });
});

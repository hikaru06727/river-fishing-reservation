import { describe, expect, it } from "vitest";
import {
  getInitialReservationStatusForPaymentMethod,
  getPaymentMethodLabel,
  getPaymentStateColor,
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

describe("getPaymentStateColor", () => {
  it("決済済み・現地精算済は緑", () => {
    expect(
      getPaymentStateColor({
        paymentMethod: "online",
        reservationStatus: "confirmed",
        paymentStatus: "succeeded",
      }),
    ).toBe("bg-green-100 text-green-800");
    expect(
      getPaymentStateColor({
        paymentMethod: "cash_at_venue",
        reservationStatus: "confirmed",
        paymentStatus: "succeeded",
      }),
    ).toBe("bg-green-100 text-green-800");
  });

  it("決済待ち・当日精算予定は黄", () => {
    expect(
      getPaymentStateColor({
        paymentMethod: "online",
        reservationStatus: "pending",
        paymentStatus: null,
      }),
    ).toBe("bg-yellow-100 text-yellow-800");
    expect(
      getPaymentStateColor({
        paymentMethod: "cash_at_venue",
        reservationStatus: "confirmed",
        paymentStatus: null,
      }),
    ).toBe("bg-yellow-100 text-yellow-800");
  });

  it("決済期限切れ・期限切れ・決済失敗は赤", () => {
    expect(
      getPaymentStateColor({
        paymentMethod: "online",
        reservationStatus: "expired",
        paymentStatus: null,
      }),
    ).toBe("bg-red-100 text-red-800");
    expect(
      getPaymentStateColor({
        paymentMethod: "cash_at_venue",
        reservationStatus: "expired",
        paymentStatus: null,
      }),
    ).toBe("bg-red-100 text-red-800");
    expect(
      getPaymentStateColor({
        paymentMethod: "online",
        reservationStatus: "pending",
        paymentStatus: "failed",
      }),
    ).toBe("bg-red-100 text-red-800");
  });

  it("キャンセル済は支払い成功ではないためグレー（緑になる回帰を防止）", () => {
    expect(
      getPaymentStateColor({
        paymentMethod: "cash_at_venue",
        reservationStatus: "cancelled",
        paymentStatus: null,
      }),
    ).toBe("bg-slate-100 text-slate-600");
    expect(
      getPaymentStateColor({
        paymentMethod: "online",
        reservationStatus: "cancelled",
        paymentStatus: "succeeded",
      }),
    ).toBe("bg-slate-100 text-slate-600");
  });

  it("返金済はグレー", () => {
    expect(
      getPaymentStateColor({
        paymentMethod: "online",
        reservationStatus: "pending",
        paymentStatus: "refunded",
      }),
    ).toBe("bg-slate-100 text-slate-600");
  });
});

describe("getPaymentMethodLabel", () => {
  it("現金精算ラベル", () => {
    expect(getPaymentMethodLabel("cash_at_venue")).toContain("現金");
  });
});

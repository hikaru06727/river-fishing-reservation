import { describe, expect, it } from "vitest";
import {
  evaluateStripeCheckoutEligibility,
  getWebhookSkipReasonForCashOrNonPending,
  shouldConfirmReservationViaStripeWebhook,
} from "@/lib/reservations/checkout-eligibility";
import { shouldExpirePendingReservation, shouldProceedToStripeCheckout } from "@/lib/reservations/payment-method";

describe("evaluateStripeCheckoutEligibility", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  it("online pending + 期限内は Checkout 可", () => {
    expect(
      evaluateStripeCheckoutEligibility({
        payment_method: "online",
        status: "pending",
        expires_at: future,
      }).ok,
    ).toBe(true);
  });

  it("cash_at_venue は Checkout 拒否", () => {
    const result = evaluateStripeCheckoutEligibility({
      payment_method: "cash_at_venue",
      status: "confirmed",
      expires_at: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("現金精算");
      expect(result.status).toBe(422);
    }
  });

  it("online confirmed は Checkout 拒否", () => {
    const result = evaluateStripeCheckoutEligibility({
      payment_method: "online",
      status: "confirmed",
      expires_at: future,
    });
    expect(result.ok).toBe(false);
  });
});

describe("shouldConfirmReservationViaStripeWebhook", () => {
  it("online pending のみ webhook 確定対象", () => {
    expect(
      shouldConfirmReservationViaStripeWebhook({
        payment_method: "online",
        status: "pending",
      }),
    ).toBe(true);
    expect(
      shouldConfirmReservationViaStripeWebhook({
        payment_method: "cash_at_venue",
        status: "confirmed",
      }),
    ).toBe(false);
    expect(
      shouldConfirmReservationViaStripeWebhook({
        payment_method: "online",
        status: "confirmed",
      }),
    ).toBe(false);
  });
});

describe("getWebhookSkipReasonForCashOrNonPending", () => {
  it("cash_at_venue は専用 skip reason", () => {
    expect(
      getWebhookSkipReasonForCashOrNonPending({
        payment_method: "cash_at_venue",
        status: "confirmed",
      }),
    ).toBe("cash_at_venue_not_webhook_target");
  });
});

describe("shouldProceedToStripeCheckout", () => {
  it("online のみ true", () => {
    expect(shouldProceedToStripeCheckout("online")).toBe(true);
    expect(shouldProceedToStripeCheckout("cash_at_venue")).toBe(false);
  });
});

describe("shouldExpirePendingReservation", () => {
  it("cash_at_venue pending でも失効対象外（通常 confirmed だが防御）", () => {
    expect(shouldExpirePendingReservation("cash_at_venue", "pending")).toBe(false);
    expect(shouldExpirePendingReservation("online", "pending")).toBe(true);
  });
});

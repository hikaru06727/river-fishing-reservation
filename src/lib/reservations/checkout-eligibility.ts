import type { PaymentMethod } from "@/lib/reservations/payment-method";
import type { ReservationStatus } from "@/types/database";

export type CheckoutEligibilityInput = {
  payment_method: PaymentMethod;
  status: ReservationStatus;
  expires_at: string | null;
};

export type CheckoutEligibilityResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

/** /api/checkout が Stripe Session を作成してよいか */
export function evaluateStripeCheckoutEligibility(
  reservation: CheckoutEligibilityInput,
  now: Date = new Date(),
): CheckoutEligibilityResult {
  if (reservation.payment_method !== "online") {
    return {
      ok: false,
      error: "現金精算の予約はオンライン決済できません",
      status: 422,
    };
  }

  if (reservation.status !== "pending") {
    return {
      ok: false,
      error: "この予約は決済できません",
      status: 422,
    };
  }

  if (!reservation.expires_at || new Date(reservation.expires_at) <= now) {
    return {
      ok: false,
      error: "決済期限が切れています。再度予約してください。",
      status: 422,
    };
  }

  return { ok: true };
}

export type WebhookConfirmEligibilityInput = {
  payment_method: PaymentMethod;
  status: ReservationStatus;
};

/** Stripe webhook が pending → confirmed してよいか */
export function shouldConfirmReservationViaStripeWebhook(
  reservation: WebhookConfirmEligibilityInput,
): boolean {
  return reservation.payment_method === "online" && reservation.status === "pending";
}

export function getWebhookSkipReasonForCashOrNonPending(
  reservation: WebhookConfirmEligibilityInput,
): string {
  if (reservation.payment_method === "cash_at_venue") {
    return "cash_at_venue_not_webhook_target";
  }
  if (reservation.status !== "pending") {
    return reservation.status === "expired"
      ? "expired"
      : reservation.status === "confirmed" || reservation.status === "cancelled"
        ? "already_processed"
        : "concurrent_state_change";
  }
  return "concurrent_state_change";
}

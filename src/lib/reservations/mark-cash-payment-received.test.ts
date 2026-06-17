import { describe, expect, it } from "vitest";
import {
  canMarkCashPaymentReceived,
  isCashPaymentAlreadyReceived,
} from "@/lib/reservations/mark-cash-payment-received";

const cashConfirmedPending = {
  payment_method: "cash_at_venue" as const,
  reservation_status: "confirmed" as const,
  payment_status: "pending" as const,
};

describe("canMarkCashPaymentReceived", () => {
  it("cash + confirmed + pending → true", () => {
    expect(canMarkCashPaymentReceived(cashConfirmedPending)).toBe(true);
  });

  it("cash + confirmed + succeeded → false（操作不要）", () => {
    expect(
      canMarkCashPaymentReceived({
        ...cashConfirmedPending,
        payment_status: "succeeded",
      }),
    ).toBe(false);
  });

  it("online → false", () => {
    expect(
      canMarkCashPaymentReceived({
        payment_method: "online",
        reservation_status: "pending",
        payment_status: "pending",
      }),
    ).toBe(false);
  });

  it("cancelled → false", () => {
    expect(
      canMarkCashPaymentReceived({
        ...cashConfirmedPending,
        reservation_status: "cancelled",
      }),
    ).toBe(false);
  });

  it("expired → false", () => {
    expect(
      canMarkCashPaymentReceived({
        ...cashConfirmedPending,
        reservation_status: "expired",
      }),
    ).toBe(false);
  });

  it("payment レコードなし → false", () => {
    expect(
      canMarkCashPaymentReceived({
        ...cashConfirmedPending,
        payment_status: null,
      }),
    ).toBe(false);
  });

  it("failed / refunded → false", () => {
    expect(
      canMarkCashPaymentReceived({
        ...cashConfirmedPending,
        payment_status: "failed",
      }),
    ).toBe(false);
    expect(
      canMarkCashPaymentReceived({
        ...cashConfirmedPending,
        payment_status: "refunded",
      }),
    ).toBe(false);
  });
});

describe("isCashPaymentAlreadyReceived", () => {
  it("cash + confirmed + succeeded → true", () => {
    expect(
      isCashPaymentAlreadyReceived({
        payment_method: "cash_at_venue",
        reservation_status: "confirmed",
        payment_status: "succeeded",
      }),
    ).toBe(true);
  });

  it("cash + confirmed + pending → false", () => {
    expect(isCashPaymentAlreadyReceived(cashConfirmedPending)).toBe(false);
  });
});

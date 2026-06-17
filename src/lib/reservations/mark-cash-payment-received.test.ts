import { describe, expect, it } from "vitest";
import {
  canMarkCashPaymentReceived,
  getAdminCashPaymentUiState,
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

  it("cash + confirmed + pending + paid_at あり → false", () => {
    expect(
      canMarkCashPaymentReceived({
        ...cashConfirmedPending,
        paid_at: "2025-06-01T00:00:00.000Z",
      }),
    ).toBe(false);
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

describe("getAdminCashPaymentUiState", () => {
  const base = {
    payment_method: "cash_at_venue" as const,
    reservation_status: "confirmed" as const,
  };

  it("cash + confirmed + payments.pending（array）→ ボタン表示", () => {
    expect(
      getAdminCashPaymentUiState({
        ...base,
        payments: [{ status: "pending", paid_at: null }],
      }),
    ).toEqual({
      showMarkButton: true,
      showAlreadyPaid: false,
      showMissingPaymentNote: false,
    });
  });

  it("cash + confirmed + payments.pending（object）→ ボタン表示", () => {
    expect(
      getAdminCashPaymentUiState({
        ...base,
        payments: { status: "pending", paid_at: null },
      }),
    ).toEqual({
      showMarkButton: true,
      showAlreadyPaid: false,
      showMissingPaymentNote: false,
    });
  });

  it("cash + confirmed + payments.succeeded → ボタンなし・現地精算済", () => {
    expect(
      getAdminCashPaymentUiState({
        ...base,
        payments: { status: "succeeded", paid_at: "2025-06-01T00:00:00.000Z" },
      }),
    ).toEqual({
      showMarkButton: false,
      showAlreadyPaid: true,
      showMissingPaymentNote: false,
    });
  });

  it("online → ボタンなし", () => {
    expect(
      getAdminCashPaymentUiState({
        payment_method: "online",
        reservation_status: "confirmed",
        payments: { status: "pending", paid_at: null },
      }),
    ).toEqual({
      showMarkButton: false,
      showAlreadyPaid: false,
      showMissingPaymentNote: false,
    });
  });

  it("payment レコードなし → ボタンなし・注記", () => {
    expect(
      getAdminCashPaymentUiState({
        ...base,
        payments: null,
      }),
    ).toEqual({
      showMarkButton: false,
      showAlreadyPaid: false,
      showMissingPaymentNote: true,
    });
  });
});

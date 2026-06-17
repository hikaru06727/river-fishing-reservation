import { describe, expect, it } from "vitest";
import {
  normalizeReservationPayments,
  resolveReservationPaymentStatus,
} from "@/lib/reservations/payment-status-display";

describe("normalizeReservationPayments", () => {
  it("null / 空配列 → []", () => {
    expect(normalizeReservationPayments(null)).toEqual([]);
    expect(normalizeReservationPayments(undefined)).toEqual([]);
    expect(normalizeReservationPayments([])).toEqual([]);
  });

  it("1:1 embed の object → 1 件の配列", () => {
    const payment = { status: "pending" as const, paid_at: null };
    expect(normalizeReservationPayments(payment)).toEqual([payment]);
  });

  it("array はそのまま", () => {
    const payments = [{ status: "pending" as const }, { status: "succeeded" as const }];
    expect(normalizeReservationPayments(payments)).toEqual(payments);
  });
});

describe("resolveReservationPaymentStatus", () => {
  it("payments が空なら null", () => {
    expect(resolveReservationPaymentStatus([])).toBeNull();
    expect(resolveReservationPaymentStatus(null)).toBeNull();
  });

  it("object 形式でも status を解決できる", () => {
    expect(resolveReservationPaymentStatus({ status: "pending" })).toBe("pending");
  });

  it("succeeded を優先", () => {
    expect(
      resolveReservationPaymentStatus([
        { status: "pending" },
        { status: "succeeded" },
      ]),
    ).toBe("succeeded");
  });
});

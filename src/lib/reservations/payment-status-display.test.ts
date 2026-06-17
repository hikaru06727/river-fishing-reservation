import { describe, expect, it } from "vitest";
import { resolveReservationPaymentStatus } from "@/lib/reservations/payment-status-display";

describe("resolveReservationPaymentStatus", () => {
  it("payments が空なら null", () => {
    expect(resolveReservationPaymentStatus([])).toBeNull();
    expect(resolveReservationPaymentStatus(null)).toBeNull();
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

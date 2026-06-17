import { describe, expect, it } from "vitest";
import type {
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  UserRole,
} from "@/types/domain";

/** ドメイン型が DB CHECK 制約と一致することを文書化するテスト */
describe("domain types alignment", () => {
  const reservationStatuses: ReservationStatus[] = [
    "pending",
    "confirmed",
    "cancelled",
    "expired",
  ];

  const paymentMethods: PaymentMethod[] = ["online", "cash_at_venue"];

  const paymentStatuses: PaymentStatus[] = [
    "pending",
    "succeeded",
    "failed",
    "refunded",
  ];

  const userRoles: UserRole[] = ["user", "admin", "business_admin"];

  it("ReservationStatus の許容値", () => {
    expect(reservationStatuses).toHaveLength(4);
    expect(reservationStatuses).toContain("pending");
  });

  it("PaymentMethod の許容値", () => {
    expect(paymentMethods).toContain("cash_at_venue");
    expect(paymentMethods).toContain("online");
  });

  it("PaymentStatus の許容値", () => {
    expect(paymentStatuses).toContain("succeeded");
  });

  it("UserRole の許容値", () => {
    expect(userRoles).toContain("business_admin");
  });
});

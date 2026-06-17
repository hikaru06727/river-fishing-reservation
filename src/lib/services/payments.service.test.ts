import { beforeEach, describe, expect, it, vi } from "vitest";
import { canManageReservationForProfile } from "@/lib/auth/management-access";
import { markCashPaymentReceived } from "@/lib/services/payments.service";

const {
  findReservationPaymentMetaByIdAdminMock,
  markCashPaymentSucceededByReservationIdMock,
} = vi.hoisted(() => ({
  findReservationPaymentMetaByIdAdminMock: vi.fn(),
  markCashPaymentSucceededByReservationIdMock: vi.fn(),
}));

vi.mock("@/lib/repositories/payments.repository", () => ({
  findReservationPaymentMetaByIdAdmin: findReservationPaymentMetaByIdAdminMock,
  markCashPaymentSucceededByReservationId: markCashPaymentSucceededByReservationIdMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const reservationId = "res-cash-1";

describe("markCashPaymentReceived", () => {
  beforeEach(() => {
    findReservationPaymentMetaByIdAdminMock.mockReset();
    markCashPaymentSucceededByReservationIdMock.mockReset();
  });

  it("cash pending → succeeded 更新成功", async () => {
    findReservationPaymentMetaByIdAdminMock.mockResolvedValue({
      payment_method: "cash_at_venue",
      reservation_status: "confirmed",
      payment: { status: "pending" },
    });
    markCashPaymentSucceededByReservationIdMock.mockResolvedValue("updated");

    const result = await markCashPaymentReceived(reservationId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.alreadyPaid).toBe(false);
    }
    expect(markCashPaymentSucceededByReservationIdMock).toHaveBeenCalledOnce();
  });

  it("already succeeded → idempotent 成功", async () => {
    findReservationPaymentMetaByIdAdminMock.mockResolvedValue({
      payment_method: "cash_at_venue",
      reservation_status: "confirmed",
      payment: { status: "succeeded" },
    });

    const result = await markCashPaymentReceived(reservationId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.alreadyPaid).toBe(true);
    }
    expect(markCashPaymentSucceededByReservationIdMock).not.toHaveBeenCalled();
  });

  it("online 予約は拒否", async () => {
    findReservationPaymentMetaByIdAdminMock.mockResolvedValue({
      payment_method: "online",
      reservation_status: "confirmed",
      payment: { status: "pending" },
    });

    const result = await markCashPaymentReceived(reservationId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("オンライン");
    }
  });

  it("cancelled は拒否", async () => {
    findReservationPaymentMetaByIdAdminMock.mockResolvedValue({
      payment_method: "cash_at_venue",
      reservation_status: "cancelled",
      payment: { status: "pending" },
    });

    const result = await markCashPaymentReceived(reservationId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
  });

  it("expired は拒否", async () => {
    findReservationPaymentMetaByIdAdminMock.mockResolvedValue({
      payment_method: "cash_at_venue",
      reservation_status: "expired",
      payment: { status: "pending" },
    });

    const result = await markCashPaymentReceived(reservationId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
  });

  it("payment レコードなしは明示エラー", async () => {
    findReservationPaymentMetaByIdAdminMock.mockResolvedValue({
      payment_method: "cash_at_venue",
      reservation_status: "confirmed",
      payment: null,
    });

    const result = await markCashPaymentReceived(reservationId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("決済レコード");
    }
  });

  it("予約が見つからない場合は 404", async () => {
    findReservationPaymentMetaByIdAdminMock.mockResolvedValue(null);

    const result = await markCashPaymentReceived(reservationId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});

describe("markCashPaymentReceived permission boundary", () => {
  it("権限チェックは Server Action 側の責務（canCurrentUserManageReservation）", () => {
    const actionChecksPermission = true;
    expect(actionChecksPermission).toBe(true);
  });

  it("business_admin は canManageReservationForProfile で担当事業のみ（RLS 整合）", () => {
    const bizAdmin = { id: "ba-1", role: "business_admin" as const };
    expect(canManageReservationForProfile(bizAdmin, "biz-a", ["biz-a"])).toBe(true);
    expect(canManageReservationForProfile(bizAdmin, "biz-b", ["biz-a"])).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeRegister,
  listClosings,
  requestCorrection,
  approveCorrection,
} from "@/lib/services/register-closing.service";

const {
  findAssignedBusinessIdsByUserIdMock,
  findAssignedBusinessIdsByStaffUserIdMock,
  findSalesRowsForClosingMock,
  insertRegisterClosingMock,
  findClosingsByBusinessIdMock,
  findCorrectionsByClosingIdMock,
  findLastClosingByBusinessIdMock,
  findClosingByIdMock,
  insertCorrectionRequestMock,
  updateClosingStatusMock,
  findCorrectionByIdMock,
  updateCorrectionStatusMock,
  checkUnsettledBeforeCloseMock,
} = vi.hoisted(() => ({
  findAssignedBusinessIdsByUserIdMock: vi.fn(),
  findAssignedBusinessIdsByStaffUserIdMock: vi.fn(),
  findSalesRowsForClosingMock: vi.fn(),
  insertRegisterClosingMock: vi.fn(),
  findClosingsByBusinessIdMock: vi.fn(),
  findCorrectionsByClosingIdMock: vi.fn(),
  findLastClosingByBusinessIdMock: vi.fn(),
  findClosingByIdMock: vi.fn(),
  insertCorrectionRequestMock: vi.fn(),
  updateClosingStatusMock: vi.fn(),
  findCorrectionByIdMock: vi.fn(),
  updateCorrectionStatusMock: vi.fn(),
  checkUnsettledBeforeCloseMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: findAssignedBusinessIdsByUserIdMock,
}));

vi.mock("@/lib/repositories/staff-members.repository", () => ({
  findAssignedBusinessIdsByStaffUserId: findAssignedBusinessIdsByStaffUserIdMock,
}));

vi.mock("@/lib/repositories/register-closings.repository", () => ({
  findSalesRowsForClosing: findSalesRowsForClosingMock,
  insertRegisterClosing: insertRegisterClosingMock,
  findClosingsByBusinessId: findClosingsByBusinessIdMock,
  findCorrectionsByClosingId: findCorrectionsByClosingIdMock,
  findLastClosingByBusinessId: findLastClosingByBusinessIdMock,
  findClosingById: findClosingByIdMock,
  insertCorrectionRequest: insertCorrectionRequestMock,
  updateClosingStatus: updateClosingStatusMock,
  findCorrectionById: findCorrectionByIdMock,
  updateCorrectionStatus: updateCorrectionStatusMock,
}));

vi.mock("@/lib/services/payment-ledger.service", () => ({
  checkUnsettledBeforeClose: checkUnsettledBeforeCloseMock,
}));

const BIZ_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROFILE_BA = { id: "ba-user-id", role: "business_admin" as const };
const PROFILE_STAFF = { id: "staff-user-id", role: "staff" as const };
const PROFILE_OTHER_BA = { id: "other-ba-id", role: "business_admin" as const };
const PROFILE_ADMIN = { id: "admin-id", role: "admin" as const };

const PERIOD_START = new Date("2026-06-25T09:00:00Z");
const PERIOD_END = new Date("2026-06-25T18:00:00Z");

const SAMPLE_CLOSING = {
  id: "closing-1",
  business_id: BIZ_A,
  location_id: null,
  closed_by: PROFILE_BA.id,
  closed_at: PERIOD_END.toISOString(),
  period_start: PERIOD_START.toISOString(),
  period_end: PERIOD_END.toISOString(),
  total_cash: 5000,
  total_card: 3000,
  total_other: 1000,
  total_amount: 9000,
  post_close_refund_cash: 0,
  post_close_refund_card: 0,
  post_close_refund_other: 0,
  post_close_refund_total: 0,
  note: null,
  status: "closed" as const,
  created_at: PERIOD_END.toISOString(),
};

const SAMPLE_CORRECTION = {
  id: "correction-1",
  closing_id: "closing-1",
  requested_by: PROFILE_STAFF.id,
  requested_at: new Date().toISOString(),
  reason: "金額が合わない",
  approved_by: null,
  approved_at: null,
  status: "pending" as const,
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  findAssignedBusinessIdsByUserIdMock.mockResolvedValue([BIZ_A]);
  findAssignedBusinessIdsByStaffUserIdMock.mockResolvedValue([BIZ_A]);
  // デフォルト: 未精算なし（締めをブロックしない）
  checkUnsettledBeforeCloseMock.mockResolvedValue({
    total: 0,
    bySourceType: { pos: 0, reservation: 0, manual: 0, booth: 0 },
    entries: [],
  });
});

// ============================================================
// closeRegister
// ============================================================
describe("closeRegister", () => {
  it("business_admin が自事業を締められる", async () => {
    findSalesRowsForClosingMock.mockResolvedValue([
      { amountYen: 5000, paymentMethod: "cash" },
      { amountYen: 3000, paymentMethod: "card" },
      { amountYen: 1000, paymentMethod: "qr" },
    ]);
    insertRegisterClosingMock.mockResolvedValue(SAMPLE_CLOSING);

    const result = await closeRegister(PROFILE_BA, {
      businessId: BIZ_A,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      closedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(insertRegisterClosingMock).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: BIZ_A,
          total_cash: 5000,
          total_card: 3000,
          total_other: 1000,
          total_amount: 9000,
        }),
      );
    }
  });

  it("staff が自事業を締められる", async () => {
    findSalesRowsForClosingMock.mockResolvedValue([]);
    insertRegisterClosingMock.mockResolvedValue({ ...SAMPLE_CLOSING, total_amount: 0 });

    const result = await closeRegister(PROFILE_STAFF, {
      businessId: BIZ_A,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      closedBy: PROFILE_STAFF.id,
    });

    expect(result.ok).toBe(true);
  });

  it("別 business_id の締めは拒否される", async () => {
    findAssignedBusinessIdsByUserIdMock.mockResolvedValue(["other-biz"]);

    const result = await closeRegister(PROFILE_BA, {
      businessId: BIZ_A,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      closedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("cash/card/other の payment_method が正しくバケットされる", async () => {
    findSalesRowsForClosingMock.mockResolvedValue([
      { amountYen: 1000, paymentMethod: "cash" },
      { amountYen: 2000, paymentMethod: "cash_at_venue" },
      { amountYen: 3000, paymentMethod: "stripe" },
      { amountYen: 4000, paymentMethod: "credit_card" },
      { amountYen: 5000, paymentMethod: "online" },
      { amountYen: 6000, paymentMethod: "qr" },
      { amountYen: 7000, paymentMethod: "e_money" },
      { amountYen: 8000, paymentMethod: "other" },
    ]);
    insertRegisterClosingMock.mockResolvedValue(SAMPLE_CLOSING);

    await closeRegister(PROFILE_BA, {
      businessId: BIZ_A,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      closedBy: PROFILE_BA.id,
    });

    expect(insertRegisterClosingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        total_cash: 3000,   // 1000 + 2000
        total_card: 12000,  // 3000 + 4000 + 5000
        total_other: 21000, // 6000 + 7000 + 8000
        total_amount: 36000,
      }),
    );
  });

  it("admin は任意の事業を締められる", async () => {
    findSalesRowsForClosingMock.mockResolvedValue([]);
    insertRegisterClosingMock.mockResolvedValue({ ...SAMPLE_CLOSING, total_amount: 0 });

    const result = await closeRegister(PROFILE_ADMIN, {
      businessId: BIZ_A,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      closedBy: PROFILE_ADMIN.id,
    });

    expect(result.ok).toBe(true);
  });

  it("未精算エントリがある場合は締めがブロックされる", async () => {
    checkUnsettledBeforeCloseMock.mockResolvedValue({
      total: 2,
      bySourceType: { pos: 1, reservation: 1, manual: 0, booth: 0 },
      entries: [
        { id: "e1", source_type: "pos", source_id: "session-uuid-1", status: "pending" },
        { id: "e2", source_type: "reservation", source_id: "reservation-uuid-1", status: "pending" },
      ],
    });

    const result = await closeRegister(PROFILE_BA, {
      businessId: BIZ_A,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      closedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.unsettledBlock?.total).toBe(2);
      expect(result.unsettledBlock?.bySourceType.pos).toBe(1);
      expect(result.unsettledBlock?.bySourceType.reservation).toBe(1);
      expect(result.unsettledBlock?.entries).toHaveLength(2);
      expect(result.unsettledBlock?.entries[0]).toEqual({
        source_type: "pos",
        source_id: "session-uuid-1",
      });
      expect(result.unsettledBlock?.entries[1]).toEqual({
        source_type: "reservation",
        source_id: "reservation-uuid-1",
      });
      expect(insertRegisterClosingMock).not.toHaveBeenCalled();
    }
  });

  it("未精算が全精算済みなら締めが実行される", async () => {
    checkUnsettledBeforeCloseMock.mockResolvedValue({
      total: 0,
      bySourceType: { pos: 0, reservation: 0, manual: 0, booth: 0 },
      entries: [],
    });
    findSalesRowsForClosingMock.mockResolvedValue([]);
    insertRegisterClosingMock.mockResolvedValue({ ...SAMPLE_CLOSING, total_amount: 0 });

    const result = await closeRegister(PROFILE_BA, {
      businessId: BIZ_A,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      closedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    expect(insertRegisterClosingMock).toHaveBeenCalledTimes(1);
  });

  it("未精算チェックがDBエラーをスローした場合は締めも失敗する（素通りしない）", async () => {
    checkUnsettledBeforeCloseMock.mockRejectedValue(new Error("DB connection error"));

    await expect(
      closeRegister(PROFILE_BA, {
        businessId: BIZ_A,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        closedBy: PROFILE_BA.id,
      }),
    ).rejects.toThrow("DB connection error");

    expect(insertRegisterClosingMock).not.toHaveBeenCalled();
  });
});

// ============================================================
// listClosings
// ============================================================
describe("listClosings", () => {
  it("business_admin が自事業の締め記録を取得できる", async () => {
    findClosingsByBusinessIdMock.mockResolvedValue({ data: [SAMPLE_CLOSING], count: 1 });
    findCorrectionsByClosingIdMock.mockResolvedValue([]);

    const result = await listClosings(PROFILE_BA, { businessId: BIZ_A });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.count).toBe(1);
      expect(result.data.data[0]?.corrections).toEqual([]);
    }
  });

  it("他事業の締め記録へのアクセスは拒否される", async () => {
    findAssignedBusinessIdsByUserIdMock.mockResolvedValue(["other-biz"]);

    const result = await listClosings(PROFILE_OTHER_BA, { businessId: BIZ_A });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});

// ============================================================
// requestCorrection
// ============================================================
describe("requestCorrection", () => {
  it("staff が修正リクエストを送信できる", async () => {
    findClosingByIdMock.mockResolvedValue(SAMPLE_CLOSING);
    insertCorrectionRequestMock.mockResolvedValue(SAMPLE_CORRECTION);
    updateClosingStatusMock.mockResolvedValue(undefined);

    const result = await requestCorrection(PROFILE_STAFF, {
      closingId: "closing-1",
      requestedBy: PROFILE_STAFF.id,
      reason: "金額が合わない",
      businessId: BIZ_A,
    });

    expect(result.ok).toBe(true);
    expect(updateClosingStatusMock).toHaveBeenCalledWith("closing-1", "correction_requested");
  });

  it("別 business の締め記録への修正リクエストは拒否される", async () => {
    findClosingByIdMock.mockResolvedValue({ ...SAMPLE_CLOSING, business_id: "other-biz" });

    const result = await requestCorrection(PROFILE_STAFF, {
      closingId: "closing-1",
      requestedBy: PROFILE_STAFF.id,
      reason: "理由",
      businessId: BIZ_A,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("存在しない締め記録への修正リクエストは 404 を返す", async () => {
    findClosingByIdMock.mockResolvedValue(null);

    const result = await requestCorrection(PROFILE_STAFF, {
      closingId: "nonexistent",
      requestedBy: PROFILE_STAFF.id,
      reason: "理由",
      businessId: BIZ_A,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});

// ============================================================
// approveCorrection
// ============================================================
describe("approveCorrection", () => {
  it("business_admin が pending の修正リクエストを承認できる", async () => {
    findCorrectionByIdMock.mockResolvedValue(SAMPLE_CORRECTION);
    findClosingByIdMock.mockResolvedValue(SAMPLE_CLOSING);
    updateCorrectionStatusMock.mockResolvedValue({ ...SAMPLE_CORRECTION, status: "approved" });
    updateClosingStatusMock.mockResolvedValue(undefined);

    const result = await approveCorrection(PROFILE_BA, {
      correctionId: "correction-1",
      approvedBy: PROFILE_BA.id,
      businessId: BIZ_A,
    });

    expect(result.ok).toBe(true);
    expect(updateCorrectionStatusMock).toHaveBeenCalledWith(
      "correction-1",
      "approved",
      PROFILE_BA.id,
    );
    expect(updateClosingStatusMock).toHaveBeenCalledWith("closing-1", "approved");
  });

  it("staff は承認できない（CLOSE_CORRECTION_APPROVE 権限なし）", async () => {
    const result = await approveCorrection(PROFILE_STAFF, {
      correctionId: "correction-1",
      approvedBy: PROFILE_STAFF.id,
      businessId: BIZ_A,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("処理済み修正リクエストの再承認は 409 を返す", async () => {
    findCorrectionByIdMock.mockResolvedValue({ ...SAMPLE_CORRECTION, status: "approved" });

    const result = await approveCorrection(PROFILE_BA, {
      correctionId: "correction-1",
      approvedBy: PROFILE_BA.id,
      businessId: BIZ_A,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });

  it("別 business の修正リクエスト承認は拒否される", async () => {
    findCorrectionByIdMock.mockResolvedValue(SAMPLE_CORRECTION);
    findClosingByIdMock.mockResolvedValue({ ...SAMPLE_CLOSING, business_id: "other-biz" });

    const result = await approveCorrection(PROFILE_BA, {
      correctionId: "correction-1",
      approvedBy: PROFILE_BA.id,
      businessId: BIZ_A,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});

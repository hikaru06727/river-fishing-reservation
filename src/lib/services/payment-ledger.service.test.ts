import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkUnsettledBeforeClose,
  getPaymentLedgerBySource,
  getPaymentLedgerByPeriod,
  recordPaymentLedger,
  updatePaymentStatus,
} from "@/lib/services/payment-ledger.service";

const {
  findBySourceMock,
  findByBusinessAndPeriodMock,
  findUnsettledInPeriodMock,
  upsertPaymentLedgerMock,
  updatePaymentLedgerStatusMock,
} = vi.hoisted(() => ({
  findBySourceMock: vi.fn(),
  findByBusinessAndPeriodMock: vi.fn(),
  findUnsettledInPeriodMock: vi.fn(),
  upsertPaymentLedgerMock: vi.fn(),
  updatePaymentLedgerStatusMock: vi.fn(),
}));

vi.mock("@/lib/repositories/payment-ledger.repository", () => ({
  findBySource: findBySourceMock,
  findByBusinessAndPeriod: findByBusinessAndPeriodMock,
  findUnsettledInPeriod: findUnsettledInPeriodMock,
  upsertPaymentLedger: upsertPaymentLedgerMock,
  updatePaymentLedgerStatus: updatePaymentLedgerStatusMock,
}));

const BIZ_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERIOD_START = "2026-06-25T00:00:00.000Z";
const PERIOD_END = "2026-06-25T23:59:59.999Z";

const SAMPLE_POS_ENTRY = {
  id: "ledger-1",
  business_id: BIZ_A,
  source_type: "pos" as const,
  source_id: "session-1",
  amount: 5000,
  payment_method: "cash" as const,
  status: "succeeded" as const,
  paid_at: "2026-06-25T10:00:00.000Z",
  created_at: "2026-06-25T10:00:00.000Z",
  updated_at: "2026-06-25T10:00:00.000Z",
};

const SAMPLE_PENDING_POS = { ...SAMPLE_POS_ENTRY, id: "ledger-2", status: "pending" as const };
const SAMPLE_PENDING_RES = {
  ...SAMPLE_POS_ENTRY,
  id: "ledger-3",
  source_type: "reservation" as const,
  source_id: "reservation-1",
  status: "pending" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// getPaymentLedgerBySource
// ============================================================
describe("getPaymentLedgerBySource", () => {
  it("存在するエントリを返す", async () => {
    findBySourceMock.mockResolvedValue(SAMPLE_POS_ENTRY);

    const result = await getPaymentLedgerBySource("pos", "session-1");

    expect(findBySourceMock).toHaveBeenCalledWith("pos", "session-1");
    expect(result).toEqual(SAMPLE_POS_ENTRY);
  });

  it("存在しない場合は null を返す", async () => {
    findBySourceMock.mockResolvedValue(null);

    const result = await getPaymentLedgerBySource("pos", "nonexistent");

    expect(result).toBeNull();
  });
});

// ============================================================
// getPaymentLedgerByPeriod
// ============================================================
describe("getPaymentLedgerByPeriod", () => {
  it("期間内のエントリ一覧を返す", async () => {
    findByBusinessAndPeriodMock.mockResolvedValue([SAMPLE_POS_ENTRY]);

    const result = await getPaymentLedgerByPeriod(BIZ_A, PERIOD_START, PERIOD_END);

    expect(findByBusinessAndPeriodMock).toHaveBeenCalledWith(BIZ_A, PERIOD_START, PERIOD_END);
    expect(result).toHaveLength(1);
  });

  it("期間内にエントリがない場合は空配列を返す", async () => {
    findByBusinessAndPeriodMock.mockResolvedValue([]);

    const result = await getPaymentLedgerByPeriod(BIZ_A, PERIOD_START, PERIOD_END);

    expect(result).toEqual([]);
  });
});

// ============================================================
// checkUnsettledBeforeClose
// ============================================================
describe("checkUnsettledBeforeClose", () => {
  it("未精算なしの場合 total=0 を返す", async () => {
    findUnsettledInPeriodMock.mockResolvedValue([]);

    const result = await checkUnsettledBeforeClose(BIZ_A, PERIOD_START, PERIOD_END);

    expect(result.total).toBe(0);
    expect(result.bySourceType).toEqual({ pos: 0, reservation: 0, manual: 0 });
    expect(result.entries).toEqual([]);
  });

  it("未精算あり: total と種別内訳が正しく集計される", async () => {
    findUnsettledInPeriodMock.mockResolvedValue([SAMPLE_PENDING_POS, SAMPLE_PENDING_RES]);

    const result = await checkUnsettledBeforeClose(BIZ_A, PERIOD_START, PERIOD_END);

    expect(result.total).toBe(2);
    expect(result.bySourceType.pos).toBe(1);
    expect(result.bySourceType.reservation).toBe(1);
    expect(result.bySourceType.manual).toBe(0);
    expect(result.entries).toHaveLength(2);
  });

  it("manual 種別も正しくカウントされる", async () => {
    const manualEntry = {
      ...SAMPLE_POS_ENTRY,
      id: "ledger-4",
      source_type: "manual" as const,
      source_id: "manual-1",
      status: "pending" as const,
    };
    findUnsettledInPeriodMock.mockResolvedValue([manualEntry]);

    const result = await checkUnsettledBeforeClose(BIZ_A, PERIOD_START, PERIOD_END);

    expect(result.total).toBe(1);
    expect(result.bySourceType.manual).toBe(1);
    expect(result.bySourceType.pos).toBe(0);
    expect(result.bySourceType.reservation).toBe(0);
  });
});

// ============================================================
// recordPaymentLedger
// ============================================================
describe("recordPaymentLedger", () => {
  it("upsert を正しく呼び出す", async () => {
    upsertPaymentLedgerMock.mockResolvedValue(SAMPLE_POS_ENTRY);

    const input = {
      business_id: BIZ_A,
      source_type: "pos" as const,
      source_id: "session-1",
      amount: 5000,
      payment_method: "cash" as const,
      status: "succeeded" as const,
      paid_at: "2026-06-25T10:00:00.000Z",
    };

    const result = await recordPaymentLedger(input);

    expect(upsertPaymentLedgerMock).toHaveBeenCalledWith(input);
    expect(result).toEqual(SAMPLE_POS_ENTRY);
  });
});

// ============================================================
// updatePaymentStatus
// ============================================================
describe("updatePaymentStatus", () => {
  it("ステータス更新を repository に委譲する", async () => {
    updatePaymentLedgerStatusMock.mockResolvedValue(undefined);

    await updatePaymentStatus("ledger-1", "refunded");

    expect(updatePaymentLedgerStatusMock).toHaveBeenCalledWith("ledger-1", "refunded", undefined);
  });

  it("paid_at を指定してステータス更新できる", async () => {
    updatePaymentLedgerStatusMock.mockResolvedValue(undefined);
    const paidAt = "2026-06-25T10:00:00.000Z";

    await updatePaymentStatus("ledger-1", "succeeded", paidAt);

    expect(updatePaymentLedgerStatusMock).toHaveBeenCalledWith("ledger-1", "succeeded", paidAt);
  });
});

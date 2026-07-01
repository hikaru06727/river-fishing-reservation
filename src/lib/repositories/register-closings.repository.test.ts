import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import {
  findSalesRowsForClosing,
  findClosingContainingReservationDate,
} from "./register-closings.repository";

const BIZ_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** Promise チェーン可能なクエリモックを構築する */
function buildTableQuery(data: unknown[], error: unknown = null) {
  const result = { data, error };
  const resolved = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
  };
  ["select", "eq", "in", "gte", "lte", "is", "not"].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

// ============================================================
// findSalesRowsForClosing — payment_ledger ベース
// ============================================================

describe("findSalesRowsForClosing — payment_ledger ベース", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeded エントリが amountYen / paymentMethod にマップされる", async () => {
    const ledgerRows = [
      { amount: 5000, payment_method: "cash" },
      { amount: 3000, payment_method: "card" },
    ];

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(buildTableQuery(ledgerRows)),
    } as any);

    const rows = await findSalesRowsForClosing({
      businessId: BIZ_A,
      periodStartIso: "2026-06-25T00:00:00Z",
      periodEndIso: "2026-06-25T23:59:59Z",
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ amountYen: 5000, paymentMethod: "cash" });
    expect(rows[1]).toEqual({ amountYen: 3000, paymentMethod: "card" });
  });

  it("エントリが空の場合は空配列を返す", async () => {
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(buildTableQuery([])),
    } as any);

    const rows = await findSalesRowsForClosing({
      businessId: BIZ_A,
      periodStartIso: "2026-06-25T00:00:00Z",
      periodEndIso: "2026-06-25T23:59:59Z",
    });

    expect(rows).toHaveLength(0);
  });

  it("payment_method が other のエントリも含まれる", async () => {
    const ledgerRows = [
      { amount: 1000, payment_method: "other" },
    ];

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(buildTableQuery(ledgerRows)),
    } as any);

    const rows = await findSalesRowsForClosing({
      businessId: BIZ_A,
      periodStartIso: "2026-06-25T00:00:00Z",
      periodEndIso: "2026-06-25T23:59:59Z",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ amountYen: 1000, paymentMethod: "other" });
  });

  it("DBエラーは例外として伝播する", async () => {
    const errorQuery = (() => {
      const result = { data: null, error: { message: "DB error" } };
      const resolved = Promise.resolve(result);
      const chain: Record<string, unknown> = {
        then: resolved.then.bind(resolved),
        catch: resolved.catch.bind(resolved),
      };
      ["select", "eq", "gte", "lte"].forEach((m) => {
        chain[m] = vi.fn().mockReturnValue(chain);
      });
      return chain;
    })();

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(errorQuery),
    } as any);

    await expect(
      findSalesRowsForClosing({
        businessId: BIZ_A,
        periodStartIso: "2026-06-25T00:00:00Z",
        periodEndIso: "2026-06-25T23:59:59Z",
      }),
    ).rejects.toThrow("DB error");
  });
});

// ============================================================
// findClosingContainingReservationDate — 日付オーバーラップ検索
// ============================================================

const CLOSING_ROW = {
  id: "closing-1",
  business_id: BIZ_A,
  period_start: "2026-06-24T08:00:00Z",
  period_end: "2026-06-25T08:00:00Z",
  closed_at: "2026-06-25T08:00:00Z",
  status: "closed",
  post_close_refund_cash: 0,
  post_close_refund_card: 0,
  post_close_refund_other: 0,
  post_close_refund_total: 0,
};

/** singleクエリ用モック */
function buildSingleQuery(data: unknown, error: unknown = null) {
  const result = { data, error };
  const resolved = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
  };
  ["select", "eq", "in", "gte", "lte", "order", "limit", "maybeSingle"].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

describe("findClosingContainingReservationDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("予約日が期間内にある締め記録を返す", async () => {
    const query = buildSingleQuery(CLOSING_ROW);
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(query),
    } as any);

    const result = await findClosingContainingReservationDate(BIZ_A, "2026-06-25");

    expect(result).toEqual(CLOSING_ROW);
  });

  it("期間外のときは null を返す", async () => {
    const query = buildSingleQuery(null);
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(query),
    } as any);

    const result = await findClosingContainingReservationDate(BIZ_A, "2026-06-26");

    expect(result).toBeNull();
  });

  it("lte('period_start', date T23:59:59Z) AND gte('period_end', date T00:00:00Z) でフィルタする", async () => {
    const query = buildSingleQuery(CLOSING_ROW);
    const fromMock = vi.fn().mockReturnValue(query);
    vi.mocked(createClient).mockResolvedValue({ from: fromMock } as any);

    await findClosingContainingReservationDate(BIZ_A, "2026-06-25");

    const lteMock = query["lte"] as ReturnType<typeof vi.fn>;
    const gteMock = query["gte"] as ReturnType<typeof vi.fn>;
    expect(lteMock).toHaveBeenCalledWith("period_start", "2026-06-25T23:59:59Z");
    expect(gteMock).toHaveBeenCalledWith("period_end", "2026-06-25T00:00:00Z");
  });
});

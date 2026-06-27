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

/** テーブル名ごとにデータを返す from() モックを構築する */
function buildFrom(tableData: Record<string, unknown[]>) {
  return vi.fn().mockImplementation((table: string) =>
    buildTableQuery(tableData[table] ?? []),
  );
}

describe("findSalesRowsForClosing — payment_status フィルタ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("payments に succeeded がある予約のみ集計に含まれる", async () => {
    const paidRes = {
      id: "res-paid",
      total_amount_yen: 5000,
      reserved_unit_price_yen: null,
      guest_count: 2,
      payment_method: "cash_at_venue",
      locations: { business_id: BIZ_A },
      payments: [{ status: "succeeded" }],
    };
    const unpaidRes = {
      id: "res-unpaid",
      total_amount_yen: 3000,
      reserved_unit_price_yen: null,
      guest_count: 1,
      payment_method: "cash_at_venue",
      locations: { business_id: BIZ_A },
      payments: [],
    };

    vi.mocked(createClient).mockResolvedValue({
      from: buildFrom({
        sale_refunds: [],
        reservations: [paidRes, unpaidRes],
        manual_sales: [],
        product_sales: [],
        sale_sessions: [],
      }),
    } as any);

    const rows = await findSalesRowsForClosing({
      businessId: BIZ_A,
      periodStartIso: "2026-06-25T00:00:00Z",
      periodEndIso: "2026-06-25T09:00:00Z",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ amountYen: 5000, paymentMethod: "cash_at_venue" });
  });

  it("payments が空の予約（現地決済未完了）は除外される", async () => {
    const unpaidRes = {
      id: "res-unpaid",
      total_amount_yen: 8000,
      reserved_unit_price_yen: null,
      guest_count: 1,
      payment_method: "cash_at_venue",
      locations: { business_id: BIZ_A },
      payments: [],
    };

    vi.mocked(createClient).mockResolvedValue({
      from: buildFrom({
        sale_refunds: [],
        reservations: [unpaidRes],
        manual_sales: [],
        product_sales: [],
        sale_sessions: [],
      }),
    } as any);

    const rows = await findSalesRowsForClosing({
      businessId: BIZ_A,
      periodStartIso: "2026-06-25T00:00:00Z",
      periodEndIso: "2026-06-25T09:00:00Z",
    });

    expect(rows).toHaveLength(0);
  });

  it("返金済み予約（refundedReservationIds）は集計から除外される", async () => {
    const refundedRes = {
      id: "res-refunded",
      total_amount_yen: 5000,
      reserved_unit_price_yen: null,
      guest_count: 2,
      payment_method: "cash_at_venue",
      locations: { business_id: BIZ_A },
      payments: [{ status: "succeeded" }],
    };

    vi.mocked(createClient).mockResolvedValue({
      from: buildFrom({
        sale_refunds: [{ sale_session_id: null, reservation_id: "res-refunded" }],
        reservations: [refundedRes],
        manual_sales: [],
        product_sales: [],
        sale_sessions: [],
      }),
    } as any);

    const rows = await findSalesRowsForClosing({
      businessId: BIZ_A,
      periodStartIso: "2026-06-25T00:00:00Z",
      periodEndIso: "2026-06-25T09:00:00Z",
    });

    expect(rows).toHaveLength(0);
  });

  it("返金済み sale_session は締め集計から除外される", async () => {
    const refundedSession = {
      id: "sess-refunded",
      total_amount: 3000,
      payment_method: "cash",
    };
    const normalSession = {
      id: "sess-normal",
      total_amount: 2000,
      payment_method: "card",
    };

    vi.mocked(createClient).mockResolvedValue({
      from: buildFrom({
        sale_refunds: [{ sale_session_id: "sess-refunded", reservation_id: null }],
        reservations: [],
        manual_sales: [],
        product_sales: [],
        sale_sessions: [refundedSession, normalSession],
      }),
    } as any);

    const rows = await findSalesRowsForClosing({
      businessId: BIZ_A,
      periodStartIso: "2026-06-25T00:00:00Z",
      periodEndIso: "2026-06-25T09:00:00Z",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ amountYen: 2000, paymentMethod: "card" });
  });

  it("reserved_unit_price_yen がある場合は単価 × 人数で計算される", async () => {
    const res = {
      id: "res-priced",
      total_amount_yen: 99999,
      reserved_unit_price_yen: 2000,
      guest_count: 3,
      payment_method: "online",
      locations: { business_id: BIZ_A },
      payments: [{ status: "succeeded" }],
    };

    vi.mocked(createClient).mockResolvedValue({
      from: buildFrom({
        sale_refunds: [],
        reservations: [res],
        manual_sales: [],
        product_sales: [],
        sale_sessions: [],
      }),
    } as any);

    const rows = await findSalesRowsForClosing({
      businessId: BIZ_A,
      periodStartIso: "2026-06-25T00:00:00Z",
      periodEndIso: "2026-06-25T09:00:00Z",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.amountYen).toBe(6000); // 2000 × 3
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

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { listByBusiness } from "./sale-sessions.repository";

const BIZ_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function buildChain(data: unknown, error: unknown = null) {
  const result = { data, error };
  const resolved = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
  };
  ["select", "eq", "in", "gte", "lte", "order"].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

const SESSION_ROWS = [
  {
    id: "s1",
    business_id: BIZ_ID,
    sold_at: "2026-06-25T10:00:00+09:00",
    payment_method: "cash",
    payment_other_label: null,
    tax_rate_percent: 10,
    subtotal_amount: 1000,
    discount_amount: 0,
    tax_amount: 100,
    total_amount: 1100,
    note: null,
    created_by: "user1",
    created_at: "2026-06-25T01:00:00Z",
    sale_session_items: [{ id: "i1" }],
  },
  {
    id: "s2",
    business_id: BIZ_ID,
    sold_at: "2026-06-27T10:00:00+09:00",
    payment_method: "card",
    payment_other_label: null,
    tax_rate_percent: 10,
    subtotal_amount: 2000,
    discount_amount: 0,
    tax_amount: 200,
    total_amount: 2200,
    note: null,
    created_by: "user1",
    created_at: "2026-06-27T01:00:00Z",
    sale_session_items: [],
  },
];

describe("listByBusiness — onlyUnsettled フィルタ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("onlyUnsettled 未指定の場合は全セッションを返す", async () => {
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(buildChain(SESSION_ROWS)),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await listByBusiness(BIZ_ID);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("onlyUnsettled: false の場合は締め済みクエリを実行しない", async () => {
    const fromMock = vi.fn().mockReturnValue(buildChain(SESSION_ROWS));
    vi.mocked(createClient).mockResolvedValue({
      from: fromMock,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    await listByBusiness(BIZ_ID, { onlyUnsettled: false });

    // sale_sessions の1回のみ
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("sale_sessions");
  });

  it("onlyUnsettled: true で締め済み期間内のセッションを除外する", async () => {
    // s1: sold_at=2026-06-25T10:00+09:00 (UTC: 2026-06-25T01:00Z) → 締め済み期間内
    // s2: sold_at=2026-06-27T10:00+09:00 (UTC: 2026-06-27T01:00Z) → 期間外
    const closedPeriods = [
      { period_start: "2026-06-25T00:00:00Z", period_end: "2026-06-25T23:59:59Z" },
    ];

    const fromMock = vi.fn()
      .mockReturnValueOnce(buildChain(SESSION_ROWS))
      .mockReturnValueOnce(buildChain(closedPeriods));
    vi.mocked(createClient).mockResolvedValue({
      from: fromMock,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await listByBusiness(BIZ_ID, { onlyUnsettled: true });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("s2");
  });

  it("onlyUnsettled: true で締め済み期間がない場合は全セッションを返す", async () => {
    const fromMock = vi.fn()
      .mockReturnValueOnce(buildChain(SESSION_ROWS))
      .mockReturnValueOnce(buildChain([]));
    vi.mocked(createClient).mockResolvedValue({
      from: fromMock,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await listByBusiness(BIZ_ID, { onlyUnsettled: true });

    expect(result).toHaveLength(2);
  });

  it("onlyUnsettled: true で全セッションが締め済みの場合は空配列を返す", async () => {
    const closedPeriods = [
      { period_start: "2026-06-25T00:00:00Z", period_end: "2026-06-27T23:59:59Z" },
    ];

    const fromMock = vi.fn()
      .mockReturnValueOnce(buildChain(SESSION_ROWS))
      .mockReturnValueOnce(buildChain(closedPeriods));
    vi.mocked(createClient).mockResolvedValue({
      from: fromMock,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await listByBusiness(BIZ_ID, { onlyUnsettled: true });

    expect(result).toHaveLength(0);
  });

  it("onlyUnsettled: true でセッションが空の場合は register_closings クエリを実行しない", async () => {
    const fromMock = vi.fn().mockReturnValue(buildChain([]));
    vi.mocked(createClient).mockResolvedValue({
      from: fromMock,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await listByBusiness(BIZ_ID, { onlyUnsettled: true });

    expect(result).toHaveLength(0);
    // sale_sessions の1回のみ（空のためregister_closingsは不要）
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("締め済みクエリのDBエラーは例外として伝播する", async () => {
    const errResult = { data: null, error: { message: "closings DB error" } };
    const errResolved = Promise.resolve(errResult);
    const errChain: Record<string, unknown> = {
      then: errResolved.then.bind(errResolved),
      catch: errResolved.catch.bind(errResolved),
    };
    ["select", "eq", "in"].forEach((m) => {
      errChain[m] = vi.fn().mockReturnValue(errChain);
    });

    const fromMock = vi.fn()
      .mockReturnValueOnce(buildChain(SESSION_ROWS))
      .mockReturnValueOnce(errChain);
    vi.mocked(createClient).mockResolvedValue({
      from: fromMock,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    await expect(listByBusiness(BIZ_ID, { onlyUnsettled: true })).rejects.toThrow(
      "closings DB error",
    );
  });

  it("複数の締め済み期間がある場合、どれかに該当するセッションを除外する", async () => {
    const closedPeriods = [
      { period_start: "2026-06-24T00:00:00Z", period_end: "2026-06-24T23:59:59Z" },
      { period_start: "2026-06-25T00:00:00Z", period_end: "2026-06-25T23:59:59Z" },
    ];

    const fromMock = vi.fn()
      .mockReturnValueOnce(buildChain(SESSION_ROWS))
      .mockReturnValueOnce(buildChain(closedPeriods));
    vi.mocked(createClient).mockResolvedValue({
      from: fromMock,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await listByBusiness(BIZ_ID, { onlyUnsettled: true });

    // s1 は 2026-06-25 の締め済み期間に該当、s2 は期間外
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("s2");
  });
});

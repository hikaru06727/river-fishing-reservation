import { beforeEach, describe, expect, it, vi } from "vitest";
import { findProductSalesTotalYen, findTodaySalesRows } from "./sales.repository";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: fromMock,
  }),
}));

function makeQueryChain(resolvedValue: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "gte", "lte", "in", "is", "order", "single", "maybeSingle"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  (chain as Record<string, unknown>).then = undefined;
  Object.defineProperty(chain, Symbol.iterator, { get: () => undefined });
  for (const m of methods) {
    (chain[m] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  }
  // last chain call resolves the promise
  (chain.lte as ReturnType<typeof vi.fn>).mockResolvedValue(resolvedValue);
  return chain;
}

describe("findTodaySalesRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("payment_ledger の succeeded エントリを amountYen / paymentMethod にマップして返す", async () => {
    const chain = makeQueryChain({
      data: [
        { amount: 3000, payment_method: "cash" },
        { amount: 1500, payment_method: "card" },
        { amount: 500, payment_method: "other" },
      ],
      error: null,
    });
    fromMock.mockReturnValue(chain);

    const rows = await findTodaySalesRows("2026-06-28");

    expect(fromMock).toHaveBeenCalledWith("payment_ledger");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ amountYen: 3000, paymentMethod: "cash" });
    expect(rows[1]).toEqual({ amountYen: 1500, paymentMethod: "card" });
    expect(rows[2]).toEqual({ amountYen: 500, paymentMethod: "other" });
  });

  it("エントリがない場合は空配列を返す", async () => {
    const chain = makeQueryChain({ data: [], error: null });
    fromMock.mockReturnValue(chain);

    const rows = await findTodaySalesRows("2026-06-28");

    expect(rows).toEqual([]);
  });

  it("DBエラーは例外として伝播する", async () => {
    const chain = makeQueryChain({ data: null, error: { message: "DB error" } });
    fromMock.mockReturnValue(chain);

    await expect(findTodaySalesRows("2026-06-28")).rejects.toThrow("DB error");
  });
});

describe("findProductSalesTotalYen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("payment_ledger の pos succeeded エントリの amount を合計して返す", async () => {
    const chain = makeQueryChain({
      data: [{ amount: 5000 }, { amount: 3000 }],
      error: null,
    });
    fromMock.mockReturnValue(chain);

    const total = await findProductSalesTotalYen({ dateFrom: "2026-06-01", dateTo: "2026-06-30" });

    expect(fromMock).toHaveBeenCalledWith("payment_ledger");
    expect(total).toBe(8000);
  });

  it("エントリがない場合は 0 を返す", async () => {
    const chain = makeQueryChain({ data: [], error: null });
    fromMock.mockReturnValue(chain);

    const total = await findProductSalesTotalYen({ dateFrom: "2026-06-01", dateTo: "2026-06-30" });

    expect(total).toBe(0);
  });

  it("DBエラーは例外として伝播する", async () => {
    const chain = makeQueryChain({ data: null, error: { message: "DB error" } });
    fromMock.mockReturnValue(chain);

    await expect(
      findProductSalesTotalYen({ dateFrom: "2026-06-01", dateTo: "2026-06-30" }),
    ).rejects.toThrow("DB error");
  });
});

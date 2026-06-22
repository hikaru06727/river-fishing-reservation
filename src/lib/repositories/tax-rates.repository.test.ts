import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getCurrentTaxRate } from "./tax-rates.repository";

function buildMockClient(mockData: unknown, mockError: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: mockData, error: mockError });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const or = vi.fn().mockReturnValue({ order });
  const lte = vi.fn().mockReturnValue({ or });
  const select = vi.fn().mockReturnValue({ lte });
  const from = vi.fn().mockReturnValue({ select });
  return { from };
}

describe("getCurrentTaxRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("現在有効な税率を返す", async () => {
    const rate = {
      id: "tax-1",
      rate_percent: 10,
      valid_from: "2019-10-01",
      valid_until: null,
      created_by: null,
      created_at: "2019-10-01T00:00:00Z",
    };
    vi.mocked(createClient).mockResolvedValue(buildMockClient(rate) as any);

    const result = await getCurrentTaxRate();
    expect(result).toEqual(rate);
  });

  it("税率が存在しない場合はnullを返す", async () => {
    vi.mocked(createClient).mockResolvedValue(buildMockClient(null) as any);

    const result = await getCurrentTaxRate();
    expect(result).toBeNull();
  });

  it("DBエラーが発生した場合は例外をスローする", async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildMockClient(null, { message: "DB error" }) as any,
    );

    await expect(getCurrentTaxRate()).rejects.toThrow("DB error");
  });
});

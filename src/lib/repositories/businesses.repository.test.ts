import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { findActiveBusinessBySlug } from "./businesses.repository";

describe("findActiveBusinessBySlug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is_active な事業を slug で解決する", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({
      data: { id: "biz-1", name: "テスト事業", slug: "test-shop" },
      error: null,
    });
    const eqActiveFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const eqSlugFn = vi.fn().mockReturnValue({ eq: eqActiveFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqSlugFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findActiveBusinessBySlug("test-shop");

    expect(result?.id).toBe("biz-1");
    expect(eqSlugFn).toHaveBeenCalledWith("slug", "test-shop");
    expect(eqActiveFn).toHaveBeenCalledWith("is_active", true);
  });

  it("存在しない slug は null を返す", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqActiveFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const eqSlugFn = vi.fn().mockReturnValue({ eq: eqActiveFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqSlugFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findActiveBusinessBySlug("unknown-shop");
    expect(result).toBeNull();
  });

  it("DBエラー時は例外をスロー", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const eqActiveFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const eqSlugFn = vi.fn().mockReturnValue({ eq: eqActiveFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqSlugFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    await expect(findActiveBusinessBySlug("test-shop")).rejects.toThrow("DB error");
  });
});

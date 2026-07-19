import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { updateProfileAddress } from "./profiles.repository";

describe("updateProfileAddress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("渡されたフィールドのみを本人の profiles レコードに更新する（Phase 20）", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });

    vi.mocked(createClient).mockResolvedValue({ from } as any);

    await updateProfileAddress("user-1", {
      phone: "090-1234-5678",
      postal_code: "100-0001",
    });

    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ phone: "090-1234-5678", postal_code: "100-0001" });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("DBエラー時は例外をスロー", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "DB error" } });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });

    vi.mocked(createClient).mockResolvedValue({ from } as any);

    await expect(updateProfileAddress("user-1", { phone: "090-1234-5678" })).rejects.toThrow(
      "DB error",
    );
  });
});

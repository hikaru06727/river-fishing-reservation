import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repositories/profiles.repository", () => ({
  updateProfileAddress: vi.fn(),
}));

import { updateProfileAddress as updateProfileAddressRepo } from "@/lib/repositories/profiles.repository";
import { updateProfileAddress } from "./profile.service";

describe("updateProfileAddress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("指定されたフィールドのみをリポジトリに渡す", async () => {
    await updateProfileAddress("user-1", {
      fullName: "山田太郎",
      phone: "090-1234-5678",
      postalCode: "100-0001",
      prefecture: "東京都",
      addressLine1: "千代田1-1",
      addressLine2: "101号室",
    });

    expect(updateProfileAddressRepo).toHaveBeenCalledWith("user-1", {
      full_name: "山田太郎",
      phone: "090-1234-5678",
      postal_code: "100-0001",
      prefecture: "東京都",
      address_line1: "千代田1-1",
      address_line2: "101号室",
    });
  });

  it("undefined のフィールドはリポジトリ呼び出しから除外する（既存の保存値を消さない）", async () => {
    await updateProfileAddress("user-1", {
      fullName: "山田太郎",
      phone: "090-1234-5678",
      // 店舗受け取り注文（住所欄なし）を想定し、住所系は未指定
    });

    const callArg = vi.mocked(updateProfileAddressRepo).mock.calls[0]?.[1];
    expect(callArg).toEqual({ full_name: "山田太郎", phone: "090-1234-5678" });
    expect(callArg).not.toHaveProperty("postal_code");
    expect(callArg).not.toHaveProperty("prefecture");
    expect(callArg).not.toHaveProperty("address_line1");
    expect(callArg).not.toHaveProperty("address_line2");
  });

  it("null を明示的に渡したフィールドはクリアする", async () => {
    await updateProfileAddress("user-1", {
      addressLine2: null,
    });

    expect(updateProfileAddressRepo).toHaveBeenCalledWith("user-1", { address_line2: null });
  });
});

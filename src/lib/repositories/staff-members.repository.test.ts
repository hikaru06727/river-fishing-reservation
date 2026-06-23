import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findStaffMembersByBusinessId,
  findStaffMemberById,
  findAssignedBusinessIdsByStaffUserId,
  insertStaffMember,
  disableStaffMember,
} from "./staff-members.repository";

function buildChain(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single, maybeSingle, ...result });
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn();
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }) });
  const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });

  // order chain for findStaffMembersByBusinessId
  const orderChain = vi.fn().mockResolvedValue(result);
  const eqForOrder = vi.fn().mockReturnValue({ order: orderChain });
  const selectForOrder = vi.fn().mockReturnValue({ eq: eqForOrder });
  const fromForOrder = vi.fn().mockReturnValue({ select: selectForOrder });

  return { from: fromForOrder, update, insert };
}

const SAMPLE_STAFF = {
  id: "staff-1",
  business_id: "biz-1",
  user_id: null,
  email: "staff@test.com",
  name: "テストスタッフ",
  role: "staff",
  status: "invited" as const,
  invited_at: "2026-06-24T00:00:00Z",
  joined_at: null,
  created_at: "2026-06-24T00:00:00Z",
};

describe("findStaffMembersByBusinessId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("事業IDに紐づくスタッフ一覧を返す", async () => {
    const maybeSingleFn = vi.fn();
    const singleFn = vi.fn();
    const orderFn = vi.fn().mockResolvedValue({ data: [SAMPLE_STAFF], error: null });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findStaffMembersByBusinessId("biz-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.email).toBe("staff@test.com");
  });

  it("DBエラー時は例外をスロー", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    await expect(findStaffMembersByBusinessId("biz-1")).rejects.toThrow("DB error");
  });
});

describe("findStaffMemberById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("IDに対応するスタッフを返す", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: SAMPLE_STAFF, error: null });
    const eqFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findStaffMemberById("staff-1");
    expect(result?.id).toBe("staff-1");
  });

  it("存在しない場合はnullを返す", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findStaffMemberById("nonexistent");
    expect(result).toBeNull();
  });
});

describe("findAssignedBusinessIdsByStaffUserId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("スタッフの事業ID一覧を返す", async () => {
    const eqStatusFn = vi.fn().mockResolvedValue({
      data: [{ business_id: "biz-1" }, { business_id: "biz-2" }],
      error: null,
    });
    const eqUserFn = vi.fn().mockReturnValue({ eq: eqStatusFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqUserFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findAssignedBusinessIdsByStaffUserId("user-1");
    expect(result).toEqual(["biz-1", "biz-2"]);
  });
});

describe("insertStaffMember", () => {
  beforeEach(() => vi.clearAllMocks());

  it("スタッフを挿入してレコードを返す", async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: SAMPLE_STAFF, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

    vi.mocked(createAdminClient).mockReturnValue({ from: fromFn } as any);

    const result = await insertStaffMember({
      business_id: "biz-1",
      email: "staff@test.com",
    });
    expect(result.email).toBe("staff@test.com");
  });

  it("DBエラー時は例外をスロー", async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: null, error: { message: "unique violation" } });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

    vi.mocked(createAdminClient).mockReturnValue({ from: fromFn } as any);

    await expect(
      insertStaffMember({ business_id: "biz-1", email: "dup@test.com" }),
    ).rejects.toThrow("unique violation");
  });
});

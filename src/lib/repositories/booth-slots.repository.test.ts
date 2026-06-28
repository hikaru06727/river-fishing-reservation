import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import {
  findSlotsByBoothId,
  findSlotsByBusinessAndDate,
  insertBoothSlots,
  updateBoothSlotStatus,
  countBookingsForSlot,
} from "./booth-slots.repository";

const SAMPLE_SLOT = {
  id: "slot-1",
  business_id: "biz-1",
  booth_id: "booth-1",
  date: "2026-07-01",
  start_time: "09:00:00",
  end_time: "12:00:00",
  max_bookings: 2,
  status: "open" as const,
  created_at: "2026-06-29T00:00:00Z",
  updated_at: "2026-06-29T00:00:00Z",
};

describe("findSlotsByBoothId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ブースIDに紐づく枠一覧を返す", async () => {
    const order2Fn = vi.fn().mockResolvedValue({ data: [SAMPLE_SLOT], error: null });
    const order1Fn = vi.fn().mockReturnValue({ order: order2Fn });
    const eqFn = vi.fn().mockReturnValue({ order: order1Fn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findSlotsByBoothId("booth-1");
    expect(result).toEqual([SAMPLE_SLOT]);
    expect(fromFn).toHaveBeenCalledWith("booth_slots");
    expect(eqFn).toHaveBeenCalledWith("booth_id", "booth-1");
  });

  it("DBエラー時は Error をスロー", async () => {
    const order2Fn = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const order1Fn = vi.fn().mockReturnValue({ order: order2Fn });
    const eqFn = vi.fn().mockReturnValue({ order: order1Fn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    await expect(findSlotsByBoothId("booth-1")).rejects.toThrow("DB error");
  });
});

describe("findSlotsByBusinessAndDate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("事業ID・日付でフィルタした枠一覧を返す", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: [SAMPLE_SLOT], error: null });
    const eqDateFn = vi.fn().mockReturnValue({ order: orderFn });
    const eqBizFn = vi.fn().mockReturnValue({ eq: eqDateFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqBizFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findSlotsByBusinessAndDate("biz-1", "2026-07-01");
    expect(result).toEqual([SAMPLE_SLOT]);
    expect(eqBizFn).toHaveBeenCalledWith("business_id", "biz-1");
    expect(eqDateFn).toHaveBeenCalledWith("date", "2026-07-01");
  });
});

describe("insertBoothSlots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("空配列の場合は空配列を返す", async () => {
    const result = await insertBoothSlots([]);
    expect(result).toEqual([]);
  });

  it("枠を一括作成して返す", async () => {
    const selectFn = vi.fn().mockResolvedValue({ data: [SAMPLE_SLOT], error: null });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await insertBoothSlots([{
      business_id: "biz-1",
      booth_id: "booth-1",
      date: "2026-07-01",
      start_time: "09:00:00",
      end_time: "12:00:00",
    }]);
    expect(result).toEqual([SAMPLE_SLOT]);
    expect(fromFn).toHaveBeenCalledWith("booth_slots");
  });
});

describe("updateBoothSlotStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("枠のステータスを更新して返す", async () => {
    const fullSlot = { ...SAMPLE_SLOT, status: "full" as const };
    const singleFn = vi.fn().mockResolvedValue({ data: fullSlot, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const eqFn = vi.fn().mockReturnValue({ select: selectFn });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ update: updateFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await updateBoothSlotStatus("slot-1", "full");
    expect(result.status).toBe("full");
  });
});

describe("countBookingsForSlot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("枠の予約数を返す", async () => {
    const neqFn = vi.fn().mockResolvedValue({ count: 2, error: null });
    const eqFn = vi.fn().mockReturnValue({ neq: neqFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const count = await countBookingsForSlot("slot-1");
    expect(count).toBe(2);
  });
});

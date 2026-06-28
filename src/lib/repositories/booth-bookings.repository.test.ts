import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import {
  findBookingsBySlotId,
  findBookingsByBusinessId,
  findBookingById,
  insertBoothBooking,
  updateBoothBookingPaymentStatus,
} from "./booth-bookings.repository";

const SAMPLE_BOOKING = {
  id: "booking-1",
  business_id: "biz-1",
  booth_slot_id: "slot-1",
  customer_name: "テスト太郎",
  customer_email: "test@example.com",
  customer_phone: null,
  quantity: 1,
  unit_price: 5000,
  tax_rate: 10,
  total_amount: 5500,
  payment_status: "paid" as const,
  source: "pos" as const,
  notes: null,
  created_at: "2026-06-29T00:00:00Z",
  updated_at: "2026-06-29T00:00:00Z",
};

describe("findBookingsBySlotId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("枠IDに紐づく予約一覧を返す", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: [SAMPLE_BOOKING], error: null });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findBookingsBySlotId("slot-1");
    expect(result).toEqual([SAMPLE_BOOKING]);
    expect(fromFn).toHaveBeenCalledWith("booth_bookings");
    expect(eqFn).toHaveBeenCalledWith("booth_slot_id", "slot-1");
  });

  it("DBエラー時は Error をスロー", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    await expect(findBookingsBySlotId("slot-1")).rejects.toThrow("DB error");
  });
});

describe("findBookingsByBusinessId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("事業IDに紐づく予約一覧を返す", async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: [SAMPLE_BOOKING], error: null });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findBookingsByBusinessId("biz-1");
    expect(result).toEqual([SAMPLE_BOOKING]);
    expect(eqFn).toHaveBeenCalledWith("business_id", "biz-1");
  });
});

describe("findBookingById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("IDで予約を返す", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: SAMPLE_BOOKING, error: null });
    const eqFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findBookingById("booking-1");
    expect(result).toEqual(SAMPLE_BOOKING);
    expect(eqFn).toHaveBeenCalledWith("id", "booking-1");
  });

  it("存在しない場合は null を返す", async () => {
    const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await findBookingById("nonexistent");
    expect(result).toBeNull();
  });
});

describe("insertBoothBooking", () => {
  beforeEach(() => vi.clearAllMocks());

  it("予約を作成して返す", async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: SAMPLE_BOOKING, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await insertBoothBooking({
      business_id: "biz-1",
      booth_slot_id: "slot-1",
      customer_name: "テスト太郎",
      unit_price: 5000,
      tax_rate: 10,
      total_amount: 5500,
    });
    expect(result).toEqual(SAMPLE_BOOKING);
    expect(fromFn).toHaveBeenCalledWith("booth_bookings");
  });
});

describe("updateBoothBookingPaymentStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("支払いステータスを更新して返す", async () => {
    const updated = { ...SAMPLE_BOOKING, payment_status: "refunded" as const };
    const singleFn = vi.fn().mockResolvedValue({ data: updated, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const eqFn = vi.fn().mockReturnValue({ select: selectFn });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ update: updateFn });

    vi.mocked(createClient).mockResolvedValue({ from: fromFn } as any);

    const result = await updateBoothBookingPaymentStatus("booking-1", "refunded");
    expect(result.payment_status).toBe("refunded");
  });
});

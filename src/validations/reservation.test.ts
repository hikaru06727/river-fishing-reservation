import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkoutSchema,
  createReservationSchema,
  isAllowedStartTime,
  reservationSchema,
} from "./reservation";

const FIXED_NOW = new Date("2026-06-15T12:00:00");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("reservationSchema", () => {
  it("過去日を拒否する", () => {
    const result = reservationSchema.safeParse({
      planId: "1h",
      date: "2026-06-14",
      time: "9:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "過去の日付は選択できません")).toBe(
        true,
      );
    }
  });

  it("1h プランで許可された開始時刻を受け付ける", () => {
    const result = reservationSchema.safeParse({
      planId: "1h",
      date: "2026-06-16",
      time: "9:00",
    });
    expect(result.success).toBe(true);
  });

  it("1h プランで許可外の開始時刻を拒否する", () => {
    const result = reservationSchema.safeParse({
      planId: "1h",
      date: "2026-06-16",
      time: "12:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "選択できない時間帯です")).toBe(
        true,
      );
    }
  });

  it("3h プランで許可された開始時刻を受け付ける", () => {
    expect(isAllowedStartTime("3h", "13:00")).toBe(true);
    const result = reservationSchema.safeParse({
      planId: "3h",
      date: "2026-06-16",
      time: "13:00",
    });
    expect(result.success).toBe(true);
  });

  it("3h プランで許可外の開始時刻を拒否する", () => {
    const result = reservationSchema.safeParse({
      planId: "3h",
      date: "2026-06-16",
      time: "10:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("createReservationSchema", () => {
  const validBase = {
    spotId: "11111111-1111-4111-8111-111111111111",
    planId: "22222222-2222-4222-8222-222222222222",
    slotId: "33333333-3333-4333-8333-333333333333",
    guestCount: 2,
    paymentMethod: "online" as const,
  };

  it("paymentMethod 必須", () => {
    const result = createReservationSchema.safeParse({
      spotId: validBase.spotId,
      planId: validBase.planId,
      slotId: validBase.slotId,
      guestCount: validBase.guestCount,
      reservationDate: "2026-06-16",
    });
    expect(result.success).toBe(false);
  });

  it("cash_at_venue を受け付ける", () => {
    const result = createReservationSchema.safeParse({
      ...validBase,
      paymentMethod: "cash_at_venue",
      reservationDate: "2026-06-16",
    });
    expect(result.success).toBe(true);
  });

  it("過去の reservationDate を拒否する", () => {
    const result = createReservationSchema.safeParse({
      ...validBase,
      reservationDate: "2026-06-14",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "過去の日付は選択できません")).toBe(
        true,
      );
    }
  });
});

describe("checkoutSchema", () => {
  it("有効な reservation_id (UUID) を受け付ける", () => {
    const result = checkoutSchema.safeParse({
      reservation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(result.success).toBe(true);
  });

  it("不正な reservation_id を拒否する", () => {
    const result = checkoutSchema.safeParse({
      reservation_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("reservation_id"))).toBe(true);
    }
  });
});

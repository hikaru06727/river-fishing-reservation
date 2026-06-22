import { beforeEach, describe, expect, it, vi } from "vitest";
import { addMinutes } from "@/lib/utils/date";
import { LEGACY_SLOT_STEP_MINUTES, SLOT_STEP_MINUTES } from "@/lib/slots/slot-step";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/repositories/plans.repository", () => ({
  findActivePlanForReservation: vi.fn(),
}));

vi.mock("@/lib/repositories/slots.repository", () => ({
  findSlotById: vi.fn(),
}));

vi.mock("@/lib/repositories/business-hours.repository", () => ({
  findWeeklyHoursBySpotId: vi.fn(),
  findDateExceptionsBySpotAndDateRange: vi.fn(),
}));

vi.mock("@/lib/repositories/business-breaks.repository", () => ({
  findWeeklyBreaksBySpotId: vi.fn(),
  findExceptionBreaksBySpotAndDateRange: vi.fn(),
}));

vi.mock("@/lib/repositories/reservations.repository", () => ({
  createReservationAtomic: vi.fn(),
  findSpotNotificationMetaById: vi.fn(),
  insertPendingPaymentForReservation: vi.fn(),
  updateReservationPlanSnapshot: vi.fn(),
}));

vi.mock("@/lib/repositories/tax-rates.repository", () => ({
  getCurrentTaxRate: vi.fn().mockResolvedValue({ rate_percent: 10 }),
}));

const { fetchAffectedSlotsMock } = vi.hoisted(() => ({
  fetchAffectedSlotsMock: vi.fn(),
}));

vi.mock("@/lib/slots/affected-slots", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/slots/affected-slots")>();
  return {
    ...actual,
    fetchAffectedSlots: fetchAffectedSlotsMock,
  };
});

vi.mock("@/lib/email/reservation-emails", () => ({
  sendReservationCreatedEmails: vi.fn().mockResolvedValue(undefined),
}));

import { findActivePlanForReservation } from "@/lib/repositories/plans.repository";
import {
  findDateExceptionsBySpotAndDateRange,
  findWeeklyHoursBySpotId,
} from "@/lib/repositories/business-hours.repository";
import {
  findExceptionBreaksBySpotAndDateRange,
  findWeeklyBreaksBySpotId,
} from "@/lib/repositories/business-breaks.repository";
import {
  createReservationAtomic,
  findSpotNotificationMetaById,
  insertPendingPaymentForReservation,
  updateReservationPlanSnapshot,
} from "@/lib/repositories/reservations.repository";
import { findSlotById } from "@/lib/repositories/slots.repository";
import { createReservation } from "./reservations.service";
import type { Plan } from "@/types/database";

const spotA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const spotB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const planA = "11111111-1111-4111-8111-111111111111";
const planB = "22222222-2222-4222-8222-222222222222";
const slotId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";

function futureReservationDate(daysAhead = 14): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

const reservationDate = futureReservationDate();

function makePlan(overrides: Partial<Plan> & Pick<Plan, "id">): Plan {
  return {
    name: "テストプラン",
    slug: "1h",
    duration_minutes: 60,
    price_yen: 3000,
    is_active: true,
    location_id: spotA,
    description: null,
    max_guests: 4,
    is_visible: true,
    is_accepting_reservations: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSlotRow(
  startTime: string,
  id: string,
  slotStepMinutes: typeof LEGACY_SLOT_STEP_MINUTES | typeof SLOT_STEP_MINUTES,
  overrides?: Partial<{
    booked_count: number;
    max_capacity: number;
    status: string;
    slot_date: string;
  }>,
) {
  const startNorm = startTime.slice(0, 5);
  const endNorm = addMinutes(startNorm, slotStepMinutes);
  return {
    id,
    spot_id: spotA,
    slot_date: overrides?.slot_date ?? reservationDate,
    start_time: `${startNorm}:00`,
    end_time: `${endNorm}:00`,
    max_capacity: overrides?.max_capacity ?? 5,
    booked_count: overrides?.booked_count ?? 0,
    status: (overrides?.status ?? "open") as "open",
  };
}

function mockFetchAffectedSlotsFromStartTimes(
  startTimes: string[],
  slotStepMinutes: typeof LEGACY_SLOT_STEP_MINUTES | typeof SLOT_STEP_MINUTES,
  idPrefix: string,
  slotDate: string = reservationDate,
) {
  fetchAffectedSlotsMock.mockResolvedValue({
    slots: startTimes.map((time, index) =>
      makeSlotRow(time, `${idPrefix}-${index}`, slotStepMinutes, { slot_date: slotDate }),
    ),
    error: null,
  });
}

const FIFTEEN_MIN_2H_START_TIMES = [
  "09:15",
  "09:30",
  "09:45",
  "10:00",
  "10:15",
  "10:30",
  "10:45",
  "11:00",
] as const;

const validInput = {
  spotId: spotA,
  planId: planA,
  slotId,
  reservationDate,
  guestCount: 2,
  paymentMethod: "cash_at_venue" as const,
};

beforeEach(() => {
  vi.mocked(findWeeklyHoursBySpotId).mockResolvedValue([]);
  vi.mocked(findDateExceptionsBySpotAndDateRange).mockResolvedValue([]);
  vi.mocked(findWeeklyBreaksBySpotId).mockResolvedValue([]);
  vi.mocked(findExceptionBreaksBySpotAndDateRange).mockResolvedValue([]);
});

describe("createReservation plan/spot validation (phase 8a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, location_id: spotA }),
    );
    vi.mocked(findSlotById).mockResolvedValue(makeSlotRow("09:00", slotId, LEGACY_SLOT_STEP_MINUTES));
    mockFetchAffectedSlotsFromStartTimes(["09:00"], LEGACY_SLOT_STEP_MINUTES, "slot");
    vi.mocked(createReservationAtomic).mockResolvedValue({
      reservation_id: "res-1",
      success: true,
      error_code: null,
      error_message: null,
    });
    vi.mocked(findSpotNotificationMetaById).mockResolvedValue({
      name: "テスト釣り場",
      slug: "test-spot",
      businessId: null,
    });
    vi.mocked(insertPendingPaymentForReservation).mockResolvedValue(undefined);
    vi.mocked(updateReservationPlanSnapshot).mockResolvedValue(undefined);
  });

  it("spot A の予約で spot B の planId を使えない", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(null);

    const result = await createReservation(userId, {
      ...validInput,
      planId: planB,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("プランが見つかりません");
    }
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });

  it("is_accepting_reservations=false のプランでは予約できない", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(null);

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(false);
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });

  it("guest_count > plan.max_guests の場合は拒否される", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, max_guests: 2 }),
    );

    const result = await createReservation(userId, {
      ...validInput,
      guestCount: 3,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("2名以下");
    }
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });

  it("legacy 共通プランは移行期間中 cash_at_venue で作成できる", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, location_id: null, slug: "1h" }),
    );

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(true);
    expect(createReservationAtomic).toHaveBeenCalledOnce();
    expect(insertPendingPaymentForReservation).toHaveBeenCalledOnce();
  });

  it("任意 slug でも duration_minutes が正しければ予約できる", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({
        id: planA,
        slug: "spot-custom-2h",
        duration_minutes: 120,
      }),
    );
    mockFetchAffectedSlotsFromStartTimes(["09:00", "10:00"], LEGACY_SLOT_STEP_MINUTES, "slot");

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(true);
    expect(createReservationAtomic).toHaveBeenCalledOnce();
  });

  it("createReservation 成功後に plan snapshot を保存する", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({
        id: planA,
        name: "スナップショットプラン",
        price_yen: 4500,
        duration_minutes: 180,
      }),
    );
    mockFetchAffectedSlotsFromStartTimes(
      ["09:00", "10:00", "11:00"],
      LEGACY_SLOT_STEP_MINUTES,
      "slot",
    );

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(true);
    expect(updateReservationPlanSnapshot).toHaveBeenCalledWith("res-1", {
      reserved_plan_name: "スナップショットプラン",
      reserved_unit_price_yen: 4500,
      reserved_duration_minutes: 180,
      tax_rate_percent: 10,
    });
  });

  it("snapshot UPDATE 失敗時も予約作成は成功として返す", async () => {
    vi.mocked(updateReservationPlanSnapshot).mockRejectedValue(
      new Error("snapshot update failed"),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("createReservation dual-path (phase 9d-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, duration_minutes: 120, slug: "2h" }),
    );
    vi.mocked(createReservationAtomic).mockResolvedValue({
      reservation_id: "res-dual",
      success: true,
      error_code: null,
      error_message: null,
    });
    vi.mocked(findSpotNotificationMetaById).mockResolvedValue({
      name: "テスト釣り場",
      slug: "test-spot",
      businessId: null,
    });
    vi.mocked(updateReservationPlanSnapshot).mockResolvedValue(undefined);
  });

  it("legacy hourly 09:00 / 2h → affected slot ids が 2 件", async () => {
    vi.mocked(findSlotById).mockResolvedValue(
      makeSlotRow("09:00", slotId, LEGACY_SLOT_STEP_MINUTES),
    );
    mockFetchAffectedSlotsFromStartTimes(["09:00", "10:00"], LEGACY_SLOT_STEP_MINUTES, "legacy");

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(true);
    expect(createReservationAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        affected_slot_ids: ["legacy-0", "legacy-1"],
      }),
    );
  });

  it("15分 grid 09:15 / 2h → affected slot ids が 8 件", async () => {
    const startTimes = [...FIFTEEN_MIN_2H_START_TIMES];
    vi.mocked(findSlotById).mockResolvedValue(makeSlotRow("09:15", slotId, SLOT_STEP_MINUTES));
    mockFetchAffectedSlotsFromStartTimes(startTimes, SLOT_STEP_MINUTES, "fifteen");

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(true);
    expect(createReservationAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        affected_slot_ids: startTimes.map((_, index) => `fifteen-${index}`),
      }),
    );
  });

  it("15分 grid 09:45 / 1h → affected slot ids が 4 件", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, duration_minutes: 60, slug: "1h" }),
    );
    const startTimes = ["09:45", "10:00", "10:15", "10:30"];
    vi.mocked(findSlotById).mockResolvedValue(makeSlotRow("09:45", slotId, SLOT_STEP_MINUTES));
    mockFetchAffectedSlotsFromStartTimes(startTimes, SLOT_STEP_MINUTES, "fifteen");

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(true);
    expect(createReservationAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        affected_slot_ids: startTimes.map((_, index) => `fifteen-${index}`),
      }),
    );
  });

  it("duration が step の倍数でない場合は予約不可", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, duration_minutes: 100, slug: "100m" }),
    );
    vi.mocked(findSlotById).mockResolvedValue(makeSlotRow("09:15", slotId, SLOT_STEP_MINUTES));

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });

  it("affected slot が欠けている場合は予約不可", async () => {
    vi.mocked(findSlotById).mockResolvedValue(makeSlotRow("09:15", slotId, SLOT_STEP_MINUTES));
    fetchAffectedSlotsMock.mockResolvedValue({
      slots: [makeSlotRow("09:15", "only-one", SLOT_STEP_MINUTES)],
      error: null,
    });

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });

  it("affected slot の一部が capacity 不足なら予約不可", async () => {
    vi.mocked(findSlotById).mockResolvedValue(makeSlotRow("09:00", slotId, LEGACY_SLOT_STEP_MINUTES));
    fetchAffectedSlotsMock.mockResolvedValue({
      slots: [
        makeSlotRow("09:00", "slot-0", LEGACY_SLOT_STEP_MINUTES),
        makeSlotRow("10:00", "slot-1", LEGACY_SLOT_STEP_MINUTES, {
          booked_count: 5,
          max_capacity: 5,
        }),
      ],
      error: null,
    });

    const result = await createReservation(userId, {
      ...validInput,
      guestCount: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });

  it("15分 online pending → affected slot ids が 8 件", async () => {
    vi.mocked(findSlotById).mockResolvedValue(makeSlotRow("09:15", slotId, SLOT_STEP_MINUTES));
    mockFetchAffectedSlotsFromStartTimes(
      [...FIFTEEN_MIN_2H_START_TIMES],
      SLOT_STEP_MINUTES,
      "fifteen",
    );

    const result = await createReservation(userId, {
      ...validInput,
      paymentMethod: "online",
    });

    expect(result.ok).toBe(true);
    expect(createReservationAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        payment_method: "online",
        affected_slot_ids: FIFTEEN_MIN_2H_START_TIMES.map((_, index) => `fifteen-${index}`),
      }),
    );
    expect(insertPendingPaymentForReservation).not.toHaveBeenCalled();
  });

  it("15分 cash_at_venue → confirmed で affected slot ids が 8 件", async () => {
    vi.mocked(findSlotById).mockResolvedValue(makeSlotRow("09:15", slotId, SLOT_STEP_MINUTES));
    mockFetchAffectedSlotsFromStartTimes(
      [...FIFTEEN_MIN_2H_START_TIMES],
      SLOT_STEP_MINUTES,
      "fifteen",
    );

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(true);
    expect(createReservationAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "confirmed",
        payment_method: "cash_at_venue",
        affected_slot_ids: FIFTEEN_MIN_2H_START_TIMES.map((_, index) => `fifteen-${index}`),
      }),
    );
    expect(insertPendingPaymentForReservation).toHaveBeenCalledOnce();
    expect(updateReservationPlanSnapshot).toHaveBeenCalledWith("res-dual", {
      reserved_plan_name: "テストプラン",
      reserved_unit_price_yen: 3000,
      reserved_duration_minutes: 120,
      tax_rate_percent: 10,
    });
  });

  it("online pending の作成フローが壊れていない（legacy hourly）", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, duration_minutes: 60, slug: "1h" }),
    );
    vi.mocked(findSlotById).mockResolvedValue(makeSlotRow("09:00", slotId, LEGACY_SLOT_STEP_MINUTES));
    mockFetchAffectedSlotsFromStartTimes(["09:00"], LEGACY_SLOT_STEP_MINUTES, "legacy");

    const result = await createReservation(userId, {
      ...validInput,
      paymentMethod: "online",
    });

    expect(result.ok).toBe(true);
    expect(createReservationAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        payment_method: "online",
        expires_at: expect.any(String),
      }),
    );
    expect(insertPendingPaymentForReservation).not.toHaveBeenCalled();
  });

  it("step が判定できない slot 行は予約不可", async () => {
    vi.mocked(findSlotById).mockResolvedValue({
      ...makeSlotRow("09:00", slotId, LEGACY_SLOT_STEP_MINUTES),
      end_time: "09:00:00",
    });

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });
});

describe("createReservation business hours (phase 10)", () => {
  const weeklyHours = [
    {
      id: "wh-1",
      location_id: spotA,
      day_of_week: new Date(`${reservationDate}T00:00:00`).getDay(),
      is_open: true,
      open_time: "09:00:00",
      close_time: "17:00:00",
      is_24_hours: false,
      created_at: "",
      updated_at: "",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findWeeklyHoursBySpotId).mockResolvedValue(weeklyHours);
    vi.mocked(findDateExceptionsBySpotAndDateRange).mockResolvedValue([]);
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, duration_minutes: 120 }),
    );
    vi.mocked(findSlotById).mockResolvedValue(makeSlotRow("16:00", slotId, LEGACY_SLOT_STEP_MINUTES));
    mockFetchAffectedSlotsFromStartTimes(["16:00", "17:00"], LEGACY_SLOT_STEP_MINUTES, "slot");
  });

  it("営業時間外の開始時刻は予約を拒否する", async () => {
    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("選択できない時間帯");
    }
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });
});

describe("createReservation business breaks (phase 10b)", () => {
  const breakReservationDate = "2026-12-07";

  const weeklyHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    id: `wh-${dayOfWeek}`,
    location_id: spotA,
    day_of_week: dayOfWeek,
    is_open: dayOfWeek >= 1 && dayOfWeek <= 5,
    open_time: dayOfWeek >= 1 && dayOfWeek <= 5 ? "09:00:00" : null,
    close_time: dayOfWeek >= 1 && dayOfWeek <= 5 ? "17:00:00" : null,
    is_24_hours: false,
    created_at: "",
    updated_at: "",
  }));

  const weeklyLunchBreak = [
    {
      id: "wb-1",
      location_id: spotA,
      day_of_week: 1,
      start_time: "12:00:00",
      end_time: "13:00:00",
      label: "昼休み",
      created_at: "",
      updated_at: "",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findWeeklyHoursBySpotId).mockResolvedValue(weeklyHours);
    vi.mocked(findDateExceptionsBySpotAndDateRange).mockResolvedValue([]);
    vi.mocked(findWeeklyBreaksBySpotId).mockResolvedValue(weeklyLunchBreak);
    vi.mocked(findExceptionBreaksBySpotAndDateRange).mockResolvedValue([]);
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, duration_minutes: 120, slug: "2h" }),
    );
    vi.mocked(findSlotById).mockResolvedValue(
      makeSlotRow("11:00", slotId, SLOT_STEP_MINUTES, {
        slot_date: breakReservationDate,
      }),
    );
    mockFetchAffectedSlotsFromStartTimes(
      ["11:00", "11:15", "11:30", "11:45", "12:00", "12:15", "12:30", "12:45"],
      SLOT_STEP_MINUTES,
      "slot",
      breakReservationDate,
    );
  });

  it("休み時間に重なる予約は拒否する", async () => {
    const result = await createReservation(userId, {
      ...validInput,
      reservationDate: breakReservationDate,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toBe("選択した時間は休み時間と重なるため予約できません");
    }
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });
});

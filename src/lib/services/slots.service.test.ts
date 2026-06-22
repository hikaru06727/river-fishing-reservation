import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addMinutes } from "@/lib/utils/date";
import { LEGACY_SLOT_STEP_MINUTES, SLOT_STEP_MINUTES } from "@/lib/slots/slot-step";

vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(),
}));

vi.mock("@/lib/repositories/plans.repository", () => ({
  findActivePlanForReservation: vi.fn(),
}));

vi.mock("@/lib/repositories/slots.repository", () => ({
  findOpenSlotsBySpotAndDateRange: vi.fn(),
}));

import { findActivePlanForReservation } from "@/lib/repositories/plans.repository";
import { findOpenSlotsBySpotAndDateRange } from "@/lib/repositories/slots.repository";
import { getAvailableSlotsWithPlan } from "./slots.service";

const SPOT_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_1H_ID = "22222222-2222-4222-8222-222222222222";
const PLAN_3H_ID = "33333333-3333-4333-8333-333333333333";
const LEGACY_SLOT_DATE = "2026-06-20";
const FIFTEEN_MIN_SLOT_DATE = "2026-06-27";

function makeLegacyPlan(
  overrides: Pick<
    import("@/types/database").Plan,
    "id" | "name" | "slug" | "duration_minutes" | "price_yen"
  >,
): import("@/types/database").Plan {
  return {
    ...overrides,
    is_active: true,
    fishing_spot_id: null,
    description: null,
    max_guests: 10,
    is_visible: true,
    is_accepting_reservations: true,
    created_at: "",
    updated_at: "",
  };
}

function makeSlot(
  slotDate: string,
  startTime: string,
  idSuffix: string,
  slotStepMinutes: typeof LEGACY_SLOT_STEP_MINUTES | typeof SLOT_STEP_MINUTES = LEGACY_SLOT_STEP_MINUTES,
  overrides?: Partial<{ max_capacity: number; booked_count: number; status: string }>,
) {
  const startNorm = startTime.slice(0, 5);
  const endNorm = addMinutes(startNorm, slotStepMinutes);
  return {
    id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa${idSuffix}`,
    spot_id: SPOT_ID,
    slot_date: slotDate,
    start_time: `${startNorm}:00`,
    end_time: `${endNorm}:00`,
    max_capacity: overrides?.max_capacity ?? 5,
    booked_count: overrides?.booked_count ?? 0,
    status: (overrides?.status ?? "open") as "open",
  };
}

/** seed.sql と同様の legacy 1 時間刻みスロット（12:00 開始なし） */
function makeLegacyHourlySlots(slotDate: string = LEGACY_SLOT_DATE) {
  return [
    "06:00",
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
  ].map((time, index) => makeSlot(slotDate, time, String(index).padStart(4, "0")));
}

/** Phase 9b seed 相当: 09:00–12:00 / 13:00–16:00 の 15 分 grid（昼休み slot なし） */
function makeFifteenMinuteGridSlots(
  slotDate: string = FIFTEEN_MIN_SLOT_DATE,
  extraMorningEnd?: string,
  extraAfternoonEnd?: string,
) {
  const slots: ReturnType<typeof makeSlot>[] = [];
  let index = 0;

  const addRange = (from: string, toExclusive: string) => {
    let current = from;
    while (current < toExclusive) {
      slots.push(
        makeSlot(slotDate, current, String(index).padStart(4, "0"), SLOT_STEP_MINUTES),
      );
      index += 1;
      current = addMinutes(current, SLOT_STEP_MINUTES);
    }
  };

  addRange("09:00", extraMorningEnd ?? "12:00");
  addRange("13:00", extraAfternoonEnd ?? "16:00");
  return slots;
}

const ALL_HOURLY_SLOTS = makeLegacyHourlySlots();

describe("getAvailableSlotsWithPlan — legacy hourly", () => {
  beforeEach(() => {
    vi.mocked(findOpenSlotsBySpotAndDateRange).mockResolvedValue(ALL_HOURLY_SLOTS);
  });

  it("1h プランでは許可時刻のみ表示する", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: PLAN_1H_ID,
        name: "1時間プラン",
        slug: "1h",
        duration_minutes: 60,
        price_yen: 3000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: PLAN_1H_ID,
      date: LEGACY_SLOT_DATE,
    });

    expect(result.slots.map((s) => s.start_time).sort()).toEqual([
      "09:00",
      "10:00",
      "11:00",
      "13:00",
      "14:00",
      "15:00",
    ]);
  });

  it("3h プランでは 09:00 と 13:00 のみ表示する", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: PLAN_3H_ID,
        name: "3時間プラン",
        slug: "3h",
        duration_minutes: 180,
        price_yen: 8000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: PLAN_3H_ID,
      date: LEGACY_SLOT_DATE,
    });

    expect(result.slots.map((s) => s.start_time).sort()).toEqual(["09:00", "13:00"]);
  });

  it("08:00 や 16:00 は legacy 制限により表示しない", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: PLAN_1H_ID,
        name: "1時間プラン",
        slug: "1h",
        duration_minutes: 60,
        price_yen: 3000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: PLAN_1H_ID,
      date: LEGACY_SLOT_DATE,
    });

    const displayed = result.slots.map((s) => s.start_time);
    expect(displayed).not.toContain("08:00");
    expect(displayed).not.toContain("16:00");
    expect(displayed).not.toContain("06:00");
    expect(displayed).not.toContain("17:00");
  });

  it("120分プランは duration_minutes 基準で空き枠を判定する（任意 slug）", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: "44444444-4444-4444-8444-444444444444",
        name: "2時間プラン",
        slug: "custom-two-hour-plan",
        duration_minutes: 120,
        price_yen: 6000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: "44444444-4444-4444-8444-444444444444",
      date: LEGACY_SLOT_DATE,
    });

    expect(result.slots.map((s) => s.start_time).sort()).toEqual(["09:00", "10:00", "13:00", "14:00"]);
  });
});

describe("getAvailableSlotsWithPlan — 15分 grid", () => {
  beforeEach(() => {
    vi.mocked(findOpenSlotsBySpotAndDateRange).mockResolvedValue(makeFifteenMinuteGridSlots());
  });

  it("1h プランで 09:00 / 09:15 / 09:30 / 09:45 が候補に出る", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: PLAN_1H_ID,
        name: "1時間プラン",
        slug: "1h",
        duration_minutes: 60,
        price_yen: 3000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: PLAN_1H_ID,
      date: FIFTEEN_MIN_SLOT_DATE,
    });

    const morningStarts = ["09:00", "09:15", "09:30", "09:45"];
    for (const start of morningStarts) {
      expect(result.slots.map((s) => s.start_time)).toContain(start);
    }
  });

  it("09:15 / 2h の affected slots が 8 枠", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: "55555555-5555-4555-8555-555555555555",
        name: "2時間プラン",
        slug: "2h",
        duration_minutes: 120,
        price_yen: 6000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: "55555555-5555-4555-8555-555555555555",
      date: FIFTEEN_MIN_SLOT_DATE,
    });

    const slot = result.slots.find((s) => s.start_time === "09:15");
    expect(slot?.affected_slot_ids).toHaveLength(8);
  });

  it("09:45 / 1h の affected slots が 4 枠", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: PLAN_1H_ID,
        name: "1時間プラン",
        slug: "1h",
        duration_minutes: 60,
        price_yen: 3000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: PLAN_1H_ID,
      date: FIFTEEN_MIN_SLOT_DATE,
    });

    const slot = result.slots.find((s) => s.start_time === "09:45");
    expect(slot?.affected_slot_ids).toHaveLength(4);
  });

  it("11:45 / 1h は 12:00 slot が存在しないため候補から除外される", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: PLAN_1H_ID,
        name: "1時間プラン",
        slug: "1h",
        duration_minutes: 60,
        price_yen: 3000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: PLAN_1H_ID,
      date: FIFTEEN_MIN_SLOT_DATE,
    });

    expect(result.slots.map((s) => s.start_time)).not.toContain("11:45");
  });

  it("12:00〜12:45 は slot が存在しないため候補に出ない", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: PLAN_1H_ID,
        name: "1時間プラン",
        slug: "1h",
        duration_minutes: 60,
        price_yen: 3000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: PLAN_1H_ID,
      date: FIFTEEN_MIN_SLOT_DATE,
    });

    const displayed = result.slots.map((s) => s.start_time);
    for (const start of ["12:00", "12:15", "12:30", "12:45"]) {
      expect(displayed).not.toContain(start);
    }
  });

  it("15:45 / 1h は 16:00 以降の slot が存在しないため候補から除外される", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: PLAN_1H_ID,
        name: "1時間プラン",
        slug: "1h",
        duration_minutes: 60,
        price_yen: 3000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: PLAN_1H_ID,
      date: FIFTEEN_MIN_SLOT_DATE,
    });

    expect(result.slots.map((s) => s.start_time)).not.toContain("15:45");
  });

  it("16:00 以降の slot が存在する場合は 15:45 / 1h も候補に出る", async () => {
    vi.mocked(findOpenSlotsBySpotAndDateRange).mockResolvedValue(
      makeFifteenMinuteGridSlots(FIFTEEN_MIN_SLOT_DATE, "12:00", "17:00"),
    );
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: PLAN_1H_ID,
        name: "1時間プラン",
        slug: "1h",
        duration_minutes: 60,
        price_yen: 3000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: PLAN_1H_ID,
      date: FIFTEEN_MIN_SLOT_DATE,
    });

    expect(result.slots.map((s) => s.start_time)).toContain("15:45");
  });

  it("duration_minutes % 15 !== 0 のプランは候補に出ない", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: "66666666-6666-4666-8666-666666666666",
        name: "100分プラン",
        slug: "100m",
        duration_minutes: 100,
        price_yen: 5000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: "66666666-6666-4666-8666-666666666666",
      date: FIFTEEN_MIN_SLOT_DATE,
    });

    expect(result.slots).toHaveLength(0);
  });

  it("capacity が足りない affected slot が1つでもあれば候補に出ない", async () => {
    const slots = makeFifteenMinuteGridSlots();
    const tenSlot = slots.find((s) => s.start_time.startsWith("10:00"))!;
    tenSlot.booked_count = 5;

    vi.mocked(findOpenSlotsBySpotAndDateRange).mockResolvedValue(slots);
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: PLAN_1H_ID,
        name: "1時間プラン",
        slug: "1h",
        duration_minutes: 60,
        price_yen: 3000,
      }),
    );

    const result = await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: PLAN_1H_ID,
      date: FIFTEEN_MIN_SLOT_DATE,
      guestCount: 1,
    });

    expect(result.slots.map((s) => s.start_time)).not.toContain("09:15");
    expect(result.slots.map((s) => s.start_time)).not.toContain("09:30");
    expect(result.slots.map((s) => s.start_time)).not.toContain("09:45");
  });
});

describe("getAvailableSlotsWithPlan — date range", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T12:00:00+09:00"));
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makeLegacyPlan({
        id: PLAN_1H_ID,
        name: "1時間プラン",
        slug: "1h",
        duration_minutes: 60,
        price_yen: 3000,
      }),
    );
    vi.mocked(findOpenSlotsBySpotAndDateRange).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("date 未指定時は today から AVAILABLE_SLOT_LOOKAHEAD_DAYS まで取得する", async () => {
    await getAvailableSlotsWithPlan({
      spotId: SPOT_ID,
      planId: PLAN_1H_ID,
    });

    expect(findOpenSlotsBySpotAndDateRange).toHaveBeenCalledWith(
      SPOT_ID,
      "2026-06-19",
      "2026-07-02",
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

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
const SLOT_DATE = "2026-06-20";

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

function makeSlot(startTime: string, idSuffix: string) {
  return {
    id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa${idSuffix}`,
    spot_id: SPOT_ID,
    slot_date: SLOT_DATE,
    start_time: startTime,
    end_time: `${startTime.slice(0, 5)}:59:00`,
    max_capacity: 5,
    booked_count: 0,
    status: "open" as const,
  };
}

/** seed.sql と同様の 1 時間刻みスロット（12:00 開始なし） */
const ALL_HOURLY_SLOTS = [
  "06:00:00",
  "07:00:00",
  "08:00:00",
  "09:00:00",
  "10:00:00",
  "11:00:00",
  "13:00:00",
  "14:00:00",
  "15:00:00",
  "16:00:00",
  "17:00:00",
].map((time, index) => makeSlot(time, String(index).padStart(4, "0")));

describe("getAvailableSlotsWithPlan", () => {
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
      date: SLOT_DATE,
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
      date: SLOT_DATE,
    });

    expect(result.slots.map((s) => s.start_time).sort()).toEqual(["09:00", "13:00"]);
  });

  it("08:00 や 16:00 は表示しない", async () => {
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
      date: SLOT_DATE,
    });

    const displayed = result.slots.map((s) => s.start_time);
    expect(displayed).not.toContain("08:00");
    expect(displayed).not.toContain("16:00");
    expect(displayed).not.toContain("06:00");
    expect(displayed).not.toContain("17:00");
  });
});

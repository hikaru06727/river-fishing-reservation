import { describe, expect, it } from "vitest";
import { getAffectedSlotStartTimes } from "@/lib/slots/affected-slots";
import { LEGACY_SLOT_STEP_MINUTES } from "@/lib/slots/slot-step";
import {
  durationMinutesFromReservationTimes,
  resolveReservationDurationMinutes,
} from "./reservation-duration";

describe("resolveReservationDurationMinutes", () => {
  it("reserved_duration_minutes を最優先する", () => {
    expect(
      resolveReservationDurationMinutes({
        reserved_duration_minutes: 120,
        start_time: "09:00:00",
        end_time: "10:00:00",
      }),
    ).toBe(120);
  });

  it("reserved が NULL の場合は start/end から算出する", () => {
    expect(
      resolveReservationDurationMinutes({
        reserved_duration_minutes: null,
        start_time: "09:00:00",
        end_time: "11:00:00",
      }),
    ).toBe(120);
  });

  it("どちらも不明な場合は null", () => {
    expect(
      resolveReservationDurationMinutes({
        reserved_duration_minutes: null,
        start_time: "09:00:00",
        end_time: "09:00:00",
      }),
    ).toBeNull();
  });
});

describe("durationMinutesFromReservationTimes", () => {
  it("2時間の差分を返す", () => {
    expect(durationMinutesFromReservationTimes("09:00:00", "11:00:00")).toBe(120);
  });
});

describe("getAffectedSlotStartTimes integration (snapshot duration)", () => {
  it("plan.duration を 999 に変えても snapshot 120 分なら 2 枠", () => {
    const snapshotDuration = 120;
    const livePlanDuration = 960;

    expect(getAffectedSlotStartTimes("09:00:00", snapshotDuration, LEGACY_SLOT_STEP_MINUTES)).toEqual([
      "09:00",
      "10:00",
    ]);
    expect(
      getAffectedSlotStartTimes("09:00:00", livePlanDuration, LEGACY_SLOT_STEP_MINUTES).length,
    ).toBe(16);
    expect(
      getAffectedSlotStartTimes("09:00:00", snapshotDuration, LEGACY_SLOT_STEP_MINUTES).length,
    ).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { getAffectedSlotStartTimes } from "@/lib/slots/affected-slots";
import {
  LEGACY_SLOT_STEP_MINUTES,
  SLOT_STEP_MINUTES,
  slotStepMinutesFromSlotRow,
} from "@/lib/slots/slot-step";
import { resolveReservationDurationMinutes } from "@/lib/reservations/reservation-duration";

/**
 * Phase 9e: TS 側の dual-path ロジックが SQL helper
 * get_affected_slot_ids_for_reservation (014) と同じ前提（step / duration / 件数）になることを固定する。
 */
describe("Phase 9 dual-path parity (TS ↔ SQL helper expectations)", () => {
  function expectedAffectedCount(durationMinutes: number, slotStepMinutes: number): number {
    if (durationMinutes <= 0 || durationMinutes % slotStepMinutes !== 0) {
      return 0;
    }
    return durationMinutes / slotStepMinutes;
  }

  it("legacy hourly 09:00 / 2h → 2 枠", () => {
    const duration = 120;
    const step = LEGACY_SLOT_STEP_MINUTES;
    expect(getAffectedSlotStartTimes("09:00", duration, step)).toEqual(["09:00", "10:00"]);
    expect(getAffectedSlotStartTimes("09:00", duration, step)).toHaveLength(
      expectedAffectedCount(duration, step),
    );
  });

  it("15分 grid 09:15 / 2h → 8 枠", () => {
    const duration = 120;
    const step = SLOT_STEP_MINUTES;
    const times = getAffectedSlotStartTimes("09:15", duration, step);
    expect(times).toHaveLength(expectedAffectedCount(duration, step));
    expect(times[0]).toBe("09:15");
    expect(times[times.length - 1]).toBe("11:00");
  });

  it("duration % step !== 0 の場合は空配列（SQL helper も空配列）", () => {
    expect(getAffectedSlotStartTimes("09:15", 100, SLOT_STEP_MINUTES)).toEqual([]);
    expect(expectedAffectedCount(100, SLOT_STEP_MINUTES)).toBe(0);
  });

  it("slotStepMinutesFromSlotRow は SQL helper の step 判定と同じ 15/60 のみ", () => {
    expect(slotStepMinutesFromSlotRow("09:00:00", "10:00:00")).toBe(LEGACY_SLOT_STEP_MINUTES);
    expect(slotStepMinutesFromSlotRow("09:15:00", "09:30:00")).toBe(SLOT_STEP_MINUTES);
    expect(slotStepMinutesFromSlotRow("09:00:00", "09:45:00")).toBeNull();
  });

  it("expire/cancel 用 snapshot duration が live plan より優先される", () => {
    const snapshotDuration = resolveReservationDurationMinutes({
      reserved_duration_minutes: 120,
      start_time: "09:15:00",
      end_time: "10:00:00",
    });
    expect(snapshotDuration).toBe(120);
    expect(
      getAffectedSlotStartTimes("09:15", snapshotDuration!, SLOT_STEP_MINUTES),
    ).toHaveLength(8);
  });
});

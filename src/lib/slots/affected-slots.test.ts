import { describe, expect, it } from "vitest";
import { getAffectedSlotStartTimes } from "./affected-slots";
import { LEGACY_SLOT_STEP_MINUTES, SLOT_STEP_MINUTES } from "./slot-step";

describe("getAffectedSlotStartTimes", () => {
  it("09:15 / 120分 / 15分 step で 8 枠", () => {
    expect(getAffectedSlotStartTimes("09:15", 120, SLOT_STEP_MINUTES)).toEqual([
      "09:15",
      "09:30",
      "09:45",
      "10:00",
      "10:15",
      "10:30",
      "10:45",
      "11:00",
    ]);
  });

  it("09:45 / 60分 / 15分 step で 4 枠", () => {
    expect(getAffectedSlotStartTimes("09:45", 60, SLOT_STEP_MINUTES)).toEqual([
      "09:45",
      "10:00",
      "10:15",
      "10:30",
    ]);
  });

  it("09:00 / 120分 / 60分 step で 2 枠", () => {
    expect(getAffectedSlotStartTimes("09:00", 120, LEGACY_SLOT_STEP_MINUTES)).toEqual([
      "09:00",
      "10:00",
    ]);
  });

  it("duration=100 / step=15 は空配列", () => {
    expect(getAffectedSlotStartTimes("09:15", 100, SLOT_STEP_MINUTES)).toEqual([]);
  });

  it("duration=90 / step=60 は空配列", () => {
    expect(getAffectedSlotStartTimes("09:00", 90, LEGACY_SLOT_STEP_MINUTES)).toEqual([]);
  });

  it("invalid step=30 は空配列", () => {
    expect(getAffectedSlotStartTimes("09:00", 60, 30)).toEqual([]);
  });

  it("duration <= 0 は空配列", () => {
    expect(getAffectedSlotStartTimes("09:00", 0, LEGACY_SLOT_STEP_MINUTES)).toEqual([]);
  });

  describe("legacy hourly 1h / 2h / 3h", () => {
    it("1h @ 09:00", () => {
      expect(getAffectedSlotStartTimes("09:00", 60, LEGACY_SLOT_STEP_MINUTES)).toEqual(["09:00"]);
    });

    it("2h @ 09:00", () => {
      expect(getAffectedSlotStartTimes("09:00", 120, LEGACY_SLOT_STEP_MINUTES)).toEqual([
        "09:00",
        "10:00",
      ]);
    });

    it("3h @ 09:00", () => {
      expect(getAffectedSlotStartTimes("09:00", 180, LEGACY_SLOT_STEP_MINUTES)).toEqual([
        "09:00",
        "10:00",
        "11:00",
      ]);
    });
  });

  describe("15分 grid 1h / 2h", () => {
    it("1h @ 09:00", () => {
      expect(getAffectedSlotStartTimes("09:00", 60, SLOT_STEP_MINUTES)).toEqual([
        "09:00",
        "09:15",
        "09:30",
        "09:45",
      ]);
    });

    it("2h @ 09:00", () => {
      expect(getAffectedSlotStartTimes("09:00", 120, SLOT_STEP_MINUTES)).toHaveLength(8);
      expect(getAffectedSlotStartTimes("09:00", 120, SLOT_STEP_MINUTES)[0]).toBe("09:00");
      expect(getAffectedSlotStartTimes("09:00", 120, SLOT_STEP_MINUTES)[7]).toBe("10:45");
    });
  });
});

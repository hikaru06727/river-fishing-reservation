import { describe, expect, it } from "vitest";
import { getAffectedSlotStartTimes } from "@/lib/slots/affected-slots";
import { LEGACY_SLOT_STEP_MINUTES } from "@/lib/slots/slot-step";
import {
  BOOKABLE_HOUR_SLOTS,
  isAllowedLegacyHourlyStartTimeByDuration,
  isAllowedStartTime,
  isAllowedStartTimeByDuration,
  LEGACY_BOOKABLE_HOUR_SLOTS,
  normalizeTimeInput,
} from "./start-time-rules";

describe("normalizeTimeInput", () => {
  it("09:00 を 9:00 に正規化する", () => {
    expect(normalizeTimeInput("09:00:00")).toBe("9:00");
  });
});

describe("isAllowedLegacyHourlyStartTimeByDuration", () => {
  it("duration_minutes = 60 の開始時刻判定（legacy 1h 相当）", () => {
    expect(isAllowedLegacyHourlyStartTimeByDuration(60, "9:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(60, "10:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(60, "11:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(60, "13:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(60, "14:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(60, "15:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(60, "12:00")).toBe(false);
    expect(isAllowedLegacyHourlyStartTimeByDuration(60, "16:00")).toBe(false);
  });

  it("duration_minutes = 120 の開始時刻判定", () => {
    expect(isAllowedLegacyHourlyStartTimeByDuration(120, "9:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(120, "10:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(120, "11:00")).toBe(false);
    expect(isAllowedLegacyHourlyStartTimeByDuration(120, "13:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(120, "14:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(120, "15:00")).toBe(false);
  });

  it("duration_minutes = 180 の開始時刻判定（legacy 3h 相当）", () => {
    expect(isAllowedLegacyHourlyStartTimeByDuration(180, "9:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(180, "13:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(180, "10:00")).toBe(false);
  });

  it("任意 slug でも duration_minutes が正しければ予約開始時刻を判定できる", () => {
    expect(isAllowedLegacyHourlyStartTimeByDuration(60, "09:00:00")).toBe(true);
    expect(isAllowedLegacyHourlyStartTimeByDuration(120, "09:00:00")).toBe(true);
  });

  it("60分未満または60分単位でない duration は拒否する", () => {
    expect(isAllowedLegacyHourlyStartTimeByDuration(30, "9:00")).toBe(false);
    expect(isAllowedLegacyHourlyStartTimeByDuration(90, "9:00")).toBe(false);
  });

  it("getAffectedSlotStartTimes と整合する", () => {
    const duration = 180;
    const start = "13:00";
    const affected = getAffectedSlotStartTimes(start, duration, LEGACY_SLOT_STEP_MINUTES);
    expect(affected).toEqual(["13:00", "14:00", "15:00"]);
    expect(isAllowedLegacyHourlyStartTimeByDuration(duration, start)).toBe(true);
  });
});

describe("isAllowedStartTimeByDuration (deprecated alias)", () => {
  it("legacy hourly 判定を委譲する", () => {
    expect(isAllowedStartTimeByDuration(60, "9:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(60, "06:00")).toBe(false);
  });
});

describe("isAllowedStartTime (legacy slug wrapper)", () => {
  it("legacy 1h / 3h の既存挙動を維持する", () => {
    expect(isAllowedStartTime("1h", "9:00")).toBe(true);
    expect(isAllowedStartTime("1h", "12:00")).toBe(false);
    expect(isAllowedStartTime("3h", "13:00")).toBe(true);
    expect(isAllowedStartTime("3h", "10:00")).toBe(false);
  });
});

describe("LEGACY_BOOKABLE_HOUR_SLOTS", () => {
  it("昼休み 12 時台を含まない", () => {
    expect(LEGACY_BOOKABLE_HOUR_SLOTS).not.toContain(12);
  });

  it("BOOKABLE_HOUR_SLOTS は LEGACY_BOOKABLE_HOUR_SLOTS と同一", () => {
    expect(BOOKABLE_HOUR_SLOTS).toEqual(LEGACY_BOOKABLE_HOUR_SLOTS);
  });
});

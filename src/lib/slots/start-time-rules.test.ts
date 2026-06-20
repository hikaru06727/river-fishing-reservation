import { describe, expect, it } from "vitest";
import { getAffectedSlotStartTimes } from "@/lib/slots/affected-slots";
import {
  BOOKABLE_HOUR_SLOTS,
  isAllowedStartTime,
  isAllowedStartTimeByDuration,
  normalizeTimeInput,
} from "./start-time-rules";

describe("normalizeTimeInput", () => {
  it("09:00 を 9:00 に正規化する", () => {
    expect(normalizeTimeInput("09:00:00")).toBe("9:00");
  });
});

describe("isAllowedStartTimeByDuration", () => {
  it("duration_minutes = 60 の開始時刻判定（legacy 1h 相当）", () => {
    expect(isAllowedStartTimeByDuration(60, "9:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(60, "10:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(60, "11:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(60, "13:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(60, "14:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(60, "15:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(60, "12:00")).toBe(false);
    expect(isAllowedStartTimeByDuration(60, "16:00")).toBe(false);
  });

  it("duration_minutes = 120 の開始時刻判定", () => {
    expect(isAllowedStartTimeByDuration(120, "9:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(120, "10:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(120, "11:00")).toBe(false);
    expect(isAllowedStartTimeByDuration(120, "13:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(120, "14:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(120, "15:00")).toBe(false);
  });

  it("duration_minutes = 180 の開始時刻判定（legacy 3h 相当）", () => {
    expect(isAllowedStartTimeByDuration(180, "9:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(180, "13:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(180, "10:00")).toBe(false);
  });

  it("任意 slug でも duration_minutes が正しければ予約開始時刻を判定できる", () => {
    expect(isAllowedStartTimeByDuration(60, "09:00:00")).toBe(true);
    expect(isAllowedStartTimeByDuration(120, "09:00:00")).toBe(true);
  });

  it("60分未満または60分単位でない duration は拒否する", () => {
    expect(isAllowedStartTimeByDuration(30, "9:00")).toBe(false);
    expect(isAllowedStartTimeByDuration(90, "9:00")).toBe(false);
  });

  it("getAffectedSlotStartTimes と整合する", () => {
    const duration = 180;
    const start = "13:00";
    const affected = getAffectedSlotStartTimes(start, duration);
    expect(affected).toEqual(["13:00", "14:00", "15:00"]);
    expect(isAllowedStartTimeByDuration(duration, start)).toBe(true);
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

describe("BOOKABLE_HOUR_SLOTS", () => {
  it("昼休み 12 時台を含まない", () => {
    expect(BOOKABLE_HOUR_SLOTS).not.toContain(12);
  });
});

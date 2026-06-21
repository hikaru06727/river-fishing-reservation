import { describe, expect, it } from "vitest";
import {
  LEGACY_SLOT_STEP_MINUTES,
  parseTimeToMinutes,
  SLOT_STEP_MINUTES,
  slotStepMinutesFromSlotRow,
} from "./slot-step";

describe("parseTimeToMinutes", () => {
  it("09:00 を分に変換する", () => {
    expect(parseTimeToMinutes("09:00")).toBe(9 * 60);
  });

  it("09:00:00 を分に変換する", () => {
    expect(parseTimeToMinutes("09:00:00")).toBe(9 * 60);
  });

  it("09:00:00+00 を分に変換する", () => {
    expect(parseTimeToMinutes("09:00:00+00")).toBe(9 * 60);
  });

  it("不正な時刻文字列は null", () => {
    expect(parseTimeToMinutes("invalid")).toBeNull();
    expect(parseTimeToMinutes("")).toBeNull();
  });
});

describe("slotStepMinutesFromSlotRow", () => {
  it("09:00〜09:15 は 15 分 step", () => {
    expect(slotStepMinutesFromSlotRow("09:00", "09:15")).toBe(SLOT_STEP_MINUTES);
  });

  it("09:00〜10:00 は 60 分 step", () => {
    expect(slotStepMinutesFromSlotRow("09:00", "10:00")).toBe(LEGACY_SLOT_STEP_MINUTES);
  });

  it("09:00〜09:30 は null", () => {
    expect(slotStepMinutesFromSlotRow("09:00", "09:30")).toBeNull();
  });

  it("09:00:00〜09:15:00 は 15 分 step", () => {
    expect(slotStepMinutesFromSlotRow("09:00:00", "09:15:00")).toBe(SLOT_STEP_MINUTES);
  });

  it("不正な時刻文字列は null", () => {
    expect(slotStepMinutesFromSlotRow("bad", "09:15")).toBeNull();
    expect(slotStepMinutesFromSlotRow("09:00", "bad")).toBeNull();
  });
});

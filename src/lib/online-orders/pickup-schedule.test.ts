import { describe, expect, it } from "vitest";
import {
  computePickupDeadline,
  getJstDayRangeUtc,
  getPickupDateRange,
  isPickupDateWithinWindow,
  isValidPickupTimeSlot,
  PICKUP_TIME_SLOTS,
  toPickupDateTime,
} from "./pickup-schedule";

describe("PICKUP_TIME_SLOTS / isValidPickupTimeSlot", () => {
  it("09:00〜18:00を30分刻みで生成する", () => {
    expect(PICKUP_TIME_SLOTS[0]).toBe("09:00");
    expect(PICKUP_TIME_SLOTS[PICKUP_TIME_SLOTS.length - 1]).toBe("18:00");
    expect(PICKUP_TIME_SLOTS).toContain("12:30");
    expect(PICKUP_TIME_SLOTS.length).toBe(19);
  });

  it("範囲内・刻み内の時刻は有効", () => {
    expect(isValidPickupTimeSlot("09:00")).toBe(true);
    expect(isValidPickupTimeSlot("18:00")).toBe(true);
    expect(isValidPickupTimeSlot("13:30")).toBe(true);
  });

  it("範囲外・刻み外の時刻は無効", () => {
    expect(isValidPickupTimeSlot("08:30")).toBe(false);
    expect(isValidPickupTimeSlot("18:30")).toBe(false);
    expect(isValidPickupTimeSlot("13:15")).toBe(false);
  });
});

describe("getPickupDateRange / isPickupDateWithinWindow", () => {
  it("最小日は今日+1日、最大日は今日+30日", () => {
    const { min, max } = getPickupDateRange();
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
    expect(min > today).toBe(true);
    expect(max > min).toBe(true);
  });

  it("範囲内の日付は true、範囲外は false", () => {
    const { min, max } = getPickupDateRange();
    expect(isPickupDateWithinWindow(min)).toBe(true);
    expect(isPickupDateWithinWindow(max)).toBe(true);
    expect(isPickupDateWithinWindow("2000-01-01")).toBe(false);
    expect(isPickupDateWithinWindow("2999-01-01")).toBe(false);
  });
});

describe("toPickupDateTime / computePickupDeadline", () => {
  it("日付と時刻からJST基準のDateを作る", () => {
    const dt = toPickupDateTime("2025-08-02", "10:00");
    expect(dt.toISOString()).toBe("2025-08-02T01:00:00.000Z");
  });

  it("受け取り期限はpickup_dateの3日後", () => {
    const pickup = toPickupDateTime("2025-08-02", "10:00");
    const deadline = computePickupDeadline(pickup);
    expect(deadline.toISOString()).toBe("2025-08-05T01:00:00.000Z");
  });
});

describe("getJstDayRangeUtc", () => {
  it("指定JST暦日のUTC範囲を返す", () => {
    const { startUtc, endUtc } = getJstDayRangeUtc("2025-08-02");
    expect(startUtc).toBe("2025-08-01T15:00:00.000Z");
    expect(endUtc).toBe("2025-08-02T15:00:00.000Z");
  });
});

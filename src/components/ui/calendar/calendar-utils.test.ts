import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  firstWeekday,
  toDateString,
  buildCalendarCells,
  computeDayStatuses,
} from "./calendar-utils";

describe("daysInMonth", () => {
  it("1月は31日", () => expect(daysInMonth(2026, 1)).toBe(31));
  it("4月は30日", () => expect(daysInMonth(2026, 4)).toBe(30));
  it("2月はうるう年で29日", () => expect(daysInMonth(2024, 2)).toBe(29));
  it("2月は平年で28日", () => expect(daysInMonth(2026, 2)).toBe(28));
  it("12月は31日", () => expect(daysInMonth(2026, 12)).toBe(31));
});

describe("firstWeekday", () => {
  it("2026年7月1日は水曜日(3)", () => expect(firstWeekday(2026, 7)).toBe(3));
  it("2026年1月1日は木曜日(4)", () => expect(firstWeekday(2026, 1)).toBe(4));
  it("2024年1月1日は月曜日(1)", () => expect(firstWeekday(2024, 1)).toBe(1));
});

describe("toDateString", () => {
  it("月・日を0埋めして返す", () => {
    expect(toDateString(2026, 7, 5)).toBe("2026-07-05");
  });
  it("10日以上は0埋めしない", () => {
    expect(toDateString(2026, 12, 31)).toBe("2026-12-31");
  });
});

describe("buildCalendarCells", () => {
  it("7の倍数個のセルを生成する", () => {
    const cells = buildCalendarCells(2026, 7);
    expect(cells.length % 7).toBe(0);
  });

  it("先頭に空セル（null）が入る（2026年7月は水曜日始まりで3個）", () => {
    const cells = buildCalendarCells(2026, 7);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBeNull();
    expect(cells[2]).toBeNull();
    expect(cells[3]).toBe(1);
  });

  it("日付の数が月の日数と一致する", () => {
    const cells = buildCalendarCells(2026, 7);
    const dayCount = cells.filter((c) => c !== null).length;
    expect(dayCount).toBe(31);
  });
});

describe("computeDayStatuses", () => {
  it("空の場合はステータスなし", () => {
    expect(computeDayStatuses({})).toEqual({});
  });

  it("全枠closed → 'closed'", () => {
    const result = computeDayStatuses({
      "2026-07-01": [
        { id: "1", start_time: "09:00:00", end_time: "12:00:00", max_bookings: 2, booking_count: 0, status: "closed" },
      ],
    });
    expect(result["2026-07-01"]).toBe("closed");
  });

  it("全枠full → 'full'", () => {
    const result = computeDayStatuses({
      "2026-07-02": [
        { id: "2", start_time: "09:00:00", end_time: "12:00:00", max_bookings: 2, booking_count: 2, status: "full" },
      ],
    });
    expect(result["2026-07-02"]).toBe("full");
  });

  it("残席1の枠あり → 'limited'", () => {
    const result = computeDayStatuses({
      "2026-07-03": [
        { id: "3", start_time: "09:00:00", end_time: "12:00:00", max_bookings: 2, booking_count: 1, status: "open" },
      ],
    });
    expect(result["2026-07-03"]).toBe("limited");
  });

  it("余裕あり → 'available'", () => {
    const result = computeDayStatuses({
      "2026-07-04": [
        { id: "4", start_time: "09:00:00", end_time: "12:00:00", max_bookings: 5, booking_count: 1, status: "open" },
      ],
    });
    expect(result["2026-07-04"]).toBe("available");
  });

  it("スロットが空配列の日付はキーが作られない", () => {
    const result = computeDayStatuses({ "2026-07-05": [] });
    expect(Object.keys(result)).not.toContain("2026-07-05");
  });
});

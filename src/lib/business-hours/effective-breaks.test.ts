import { describe, expect, it } from "vitest";
import {
  findOverlappingBreakPair,
  getEffectiveBreaksForDate,
  hasBreaksConfigured,
  intervalsOverlapMinutes,
  isReservationOverlappingBreaks,
  type DateExceptionWithBreakMeta,
  type ExceptionBreakInput,
  type WeeklyBreakInput,
} from "./effective-breaks";

const weeklyLunchBreak: WeeklyBreakInput[] = [
  {
    day_of_week: 1,
    start_time: "12:00:00",
    end_time: "13:00:00",
    label: "昼休み",
  },
];

const mondayExceptionOpen: DateExceptionWithBreakMeta = {
  id: "exc-1",
  exception_date: "2026-06-22",
  is_open: true,
  open_time: "09:00",
  close_time: "17:00",
  is_24_hours: false,
  note: null,
  ignore_weekly_breaks: false,
};

describe("intervalsOverlapMinutes", () => {
  it("11:00-12:00 と 12:00-13:00 は重ならない", () => {
    expect(intervalsOverlapMinutes(11 * 60, 12 * 60, 12 * 60, 13 * 60)).toBe(false);
  });

  it("11:30-12:30 と 12:00-13:00 は重なる", () => {
    expect(intervalsOverlapMinutes(11 * 60 + 30, 12 * 60 + 30, 12 * 60, 13 * 60)).toBe(
      true,
    );
  });

  it("12:00-13:00 と 12:00-13:00 は重なる", () => {
    expect(intervalsOverlapMinutes(12 * 60, 13 * 60, 12 * 60, 13 * 60)).toBe(true);
  });

  it("13:00-14:00 と 12:00-13:00 は重ならない", () => {
    expect(intervalsOverlapMinutes(13 * 60, 14 * 60, 12 * 60, 13 * 60)).toBe(false);
  });
});

describe("isReservationOverlappingBreaks", () => {
  const lunch: BreakInterval = { startTime: "12:00", endTime: "13:00" };

  it("休み時間未設定なら重ならない", () => {
    expect(isReservationOverlappingBreaks("12:00", 60, [])).toBe(false);
  });

  it("完全に休み時間内なら不可", () => {
    expect(isReservationOverlappingBreaks("12:00", 60, [lunch])).toBe(true);
  });

  it("複数休み時間に対応する", () => {
    const breaks = [
      lunch,
      { startTime: "15:00", endTime: "15:30" },
    ];
    expect(isReservationOverlappingBreaks("14:45", 30, breaks)).toBe(true);
  });
});

type BreakInterval = { startTime: string; endTime: string };

describe("getEffectiveBreaksForDate", () => {
  it("例外日なしは曜日別を返す", () => {
    const result = getEffectiveBreaksForDate(weeklyLunchBreak, [], [], "2026-06-22");
    expect(result).toEqual([{ startTime: "12:00", endTime: "13:00", label: "昼休み" }]);
  });

  it("例外日で exception_breaks があればそちらを優先", () => {
    const exceptionBreaks: ExceptionBreakInput[] = [
      {
        date_exception_id: "exc-1",
        start_time: "14:00:00",
        end_time: "15:00:00",
        label: "準備",
      },
    ];
    const result = getEffectiveBreaksForDate(
      weeklyLunchBreak,
      exceptionBreaks,
      [mondayExceptionOpen],
      "2026-06-22",
    );
    expect(result.map((b) => b.startTime)).toEqual(["14:00"]);
  });

  it("例外日で exception_breaks 0件かつ !ignore_weekly_breaks なら曜日を継承", () => {
    const result = getEffectiveBreaksForDate(
      weeklyLunchBreak,
      [],
      [mondayExceptionOpen],
      "2026-06-22",
    );
    expect(result.map((b) => b.startTime)).toEqual(["12:00"]);
  });

  it("ignore_weekly_breaks=true かつ exception_breaks 0件なら空", () => {
    const result = getEffectiveBreaksForDate(
      weeklyLunchBreak,
      [],
      [{ ...mondayExceptionOpen, ignore_weekly_breaks: true }],
      "2026-06-22",
    );
    expect(result).toEqual([]);
  });
});

describe("hasBreaksConfigured", () => {
  it("weekly のみでも true", () => {
    expect(hasBreaksConfigured(weeklyLunchBreak, [])).toBe(true);
  });

  it("どちらも空なら false", () => {
    expect(hasBreaksConfigured([], [])).toBe(false);
  });
});

describe("findOverlappingBreakPair", () => {
  it("重複するペアを検出する", () => {
    const pair = findOverlappingBreakPair([
      { startTime: "12:00", endTime: "13:00" },
      { startTime: "12:30", endTime: "14:00" },
    ]);
    expect(pair).toEqual({ indexA: 0, indexB: 1 });
  });
});

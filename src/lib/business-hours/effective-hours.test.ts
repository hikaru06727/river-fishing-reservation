import { describe, expect, it } from "vitest";
import {
  getDayOfWeekFromDate,
  getEffectiveBusinessHoursForDate,
  hasBusinessHoursConfigured,
  isReservationWithinBusinessHours,
  type DateExceptionInput,
  type WeeklyHourInput,
} from "./effective-hours";

const weeklyOpenWeekdays: WeeklyHourInput[] = [
  { day_of_week: 0, is_open: false, open_time: null, close_time: null, is_24_hours: false },
  {
    day_of_week: 1,
    is_open: true,
    open_time: "09:00",
    close_time: "17:00",
    is_24_hours: false,
  },
  {
    day_of_week: 2,
    is_open: true,
    open_time: "09:00",
    close_time: "17:00",
    is_24_hours: false,
  },
  {
    day_of_week: 3,
    is_open: true,
    open_time: "09:00",
    close_time: "17:00",
    is_24_hours: false,
  },
  {
    day_of_week: 4,
    is_open: true,
    open_time: "09:00",
    close_time: "17:00",
    is_24_hours: false,
  },
  {
    day_of_week: 5,
    is_open: true,
    open_time: "09:00",
    close_time: "17:00",
    is_24_hours: false,
  },
  { day_of_week: 6, is_open: false, open_time: null, close_time: null, is_24_hours: false },
];

describe("hasBusinessHoursConfigured", () => {
  it("weekly が 0 行なら未設定", () => {
    expect(hasBusinessHoursConfigured([])).toBe(false);
  });

  it("weekly が 1 行以上あれば設定済み", () => {
    expect(hasBusinessHoursConfigured(weeklyOpenWeekdays)).toBe(true);
  });
});

describe("getEffectiveBusinessHoursForDate", () => {
  it("未設定 spot は isConfigured=false", () => {
    const result = getEffectiveBusinessHoursForDate([], [], "2026-06-22");
    expect(result).toEqual({ isConfigured: false });
  });

  it("休業曜日は isOpen=false", () => {
    const result = getEffectiveBusinessHoursForDate(weeklyOpenWeekdays, [], "2026-06-21");
    expect(getDayOfWeekFromDate("2026-06-21")).toBe(0);
    expect(result).toMatchObject({ isConfigured: true, isOpen: false, source: "weekly" });
  });

  it("例外日が曜日設定より優先される", () => {
    const exceptions: DateExceptionInput[] = [
      {
        exception_date: "2026-06-22",
        is_open: false,
        open_time: null,
        close_time: null,
        is_24_hours: false,
        note: "臨時休業",
      },
    ];

    const result = getEffectiveBusinessHoursForDate(
      weeklyOpenWeekdays,
      exceptions,
      "2026-06-22",
    );
    expect(result).toMatchObject({
      isConfigured: true,
      isOpen: false,
      source: "exception",
    });
  });

  it("24時間営業の例外日", () => {
    const exceptions: DateExceptionInput[] = [
      {
        exception_date: "2026-06-22",
        is_open: true,
        open_time: null,
        close_time: null,
        is_24_hours: true,
        note: null,
      },
    ];

    const result = getEffectiveBusinessHoursForDate(
      weeklyOpenWeekdays,
      exceptions,
      "2026-06-22",
    );
    expect(result).toMatchObject({
      isConfigured: true,
      isOpen: true,
      is24Hours: true,
      source: "exception",
    });
  });
});

describe("isReservationWithinBusinessHours", () => {
  it("tag_type は判定に影響しない（is_open / 営業時間のみ）", () => {
    const effective = getEffectiveBusinessHoursForDate(
      weeklyOpenWeekdays,
      [
        {
          exception_date: "2026-06-22",
          is_open: true,
          open_time: "10:00",
          close_time: "14:00",
          is_24_hours: false,
          note: "短縮営業タグ付きでも時間で判定",
        },
      ],
      "2026-06-22",
    );

    expect(isReservationWithinBusinessHours(effective, "09:00", 60)).toBe(false);
    expect(isReservationWithinBusinessHours(effective, "10:00", 60)).toBe(true);
    expect(isReservationWithinBusinessHours(effective, "13:00", 60)).toBe(true);
    expect(isReservationWithinBusinessHours(effective, "14:00", 60)).toBe(false);
  });
});

describe("isReservationWithinBusinessHours — time bounds", () => {
  const mondayEffective = getEffectiveBusinessHoursForDate(
    weeklyOpenWeekdays,
    [],
    "2026-06-22",
  );

  it("未設定 spot は常に true", () => {
    expect(
      isReservationWithinBusinessHours({ isConfigured: false }, "09:00", 60),
    ).toBe(true);
  });

  it("営業時間内なら予約可能", () => {
    expect(isReservationWithinBusinessHours(mondayEffective, "09:00", 60)).toBe(true);
    expect(isReservationWithinBusinessHours(mondayEffective, "16:00", 60)).toBe(true);
  });

  it("営業時間外なら予約不可", () => {
    expect(isReservationWithinBusinessHours(mondayEffective, "08:00", 60)).toBe(false);
    expect(isReservationWithinBusinessHours(mondayEffective, "17:00", 60)).toBe(false);
  });

  it("予約終了が営業時間を超える場合は不可", () => {
    expect(isReservationWithinBusinessHours(mondayEffective, "16:00", 120)).toBe(false);
  });

  it("休業日は予約不可", () => {
    const sunday = getEffectiveBusinessHoursForDate(weeklyOpenWeekdays, [], "2026-06-21");
    expect(isReservationWithinBusinessHours(sunday, "09:00", 60)).toBe(false);
  });

  it("24時間営業日は予約可能", () => {
    const all24h: WeeklyHourInput[] = [
      {
        day_of_week: 1,
        is_open: true,
        open_time: null,
        close_time: null,
        is_24_hours: true,
      },
    ];
    const effective = getEffectiveBusinessHoursForDate(all24h, [], "2026-06-22");
    expect(isReservationWithinBusinessHours(effective, "06:00", 180)).toBe(true);
  });
});

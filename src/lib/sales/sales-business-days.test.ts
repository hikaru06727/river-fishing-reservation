import { describe, expect, it } from "vitest";
import type { DateExceptionInput, WeeklyHourInput } from "@/lib/business-hours/effective-hours";
import {
  buildSpotBusinessHoursConfigs,
  countCalendarDaysInRange,
  countOpenBusinessDaysInRange,
  isSpotOpenOnDate,
} from "@/lib/sales/sales-business-days";

const weekdayHours: WeeklyHourInput[] = [
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

const weekendOnlyHours: WeeklyHourInput[] = [
  { day_of_week: 0, is_open: true, open_time: "09:00", close_time: "17:00", is_24_hours: false },
  { day_of_week: 1, is_open: false, open_time: null, close_time: null, is_24_hours: false },
  { day_of_week: 2, is_open: false, open_time: null, close_time: null, is_24_hours: false },
  { day_of_week: 3, is_open: false, open_time: null, close_time: null, is_24_hours: false },
  { day_of_week: 4, is_open: false, open_time: null, close_time: null, is_24_hours: false },
  { day_of_week: 5, is_open: false, open_time: null, close_time: null, is_24_hours: false },
  { day_of_week: 6, is_open: true, open_time: "09:00", close_time: "17:00", is_24_hours: false },
];

describe("countOpenBusinessDaysInRange", () => {
  it("期間内の休業日を母数に含めない", () => {
    const configs = buildSpotBusinessHoursConfigs(
      ["spot-a"],
      new Map([["spot-a", weekdayHours]]),
      new Map(),
    );

    const businessDays = countOpenBusinessDaysInRange("2026-06-01", "2026-06-07", configs);
    const calendarDays = countCalendarDaysInRange("2026-06-01", "2026-06-07");

    expect(businessDays).toBe(5);
    expect(calendarDays).toBe(7);
  });

  it("例外日の臨時休業を営業日から除外する", () => {
    const exceptions: DateExceptionInput[] = [
      {
        exception_date: "2026-06-01",
        is_open: false,
        open_time: null,
        close_time: null,
        is_24_hours: false,
        note: null,
      },
    ];
    const configs = buildSpotBusinessHoursConfigs(
      ["spot-a"],
      new Map([["spot-a", weekdayHours]]),
      new Map([["spot-a", exceptions]]),
    );

    expect(countOpenBusinessDaysInRange("2026-06-01", "2026-06-05", configs)).toBe(4);
  });

  it("admin は対象 spot のいずれかが営業している日を営業日とする", () => {
    const configs = buildSpotBusinessHoursConfigs(
      ["spot-a", "spot-b"],
      new Map([
        ["spot-a", weekdayHours],
        ["spot-b", weekendOnlyHours],
      ]),
      new Map(),
    );

    expect(countOpenBusinessDaysInRange("2026-06-01", "2026-06-07", configs)).toBe(7);
  });

  it("business_admin は担当事業 spot の営業日のみを母数にする", () => {
    const assignedOnly = buildSpotBusinessHoursConfigs(
      ["spot-a"],
      new Map([["spot-a", weekdayHours]]),
      new Map(),
    );
    const allSpots = buildSpotBusinessHoursConfigs(
      ["spot-a", "spot-b"],
      new Map([
        ["spot-a", weekdayHours],
        ["spot-b", weekendOnlyHours],
      ]),
      new Map(),
    );

    expect(countOpenBusinessDaysInRange("2026-06-01", "2026-06-07", assignedOnly)).toBe(5);
    expect(countOpenBusinessDaysInRange("2026-06-01", "2026-06-07", allSpots)).toBe(7);
  });

  it("営業時間未設定 spot のみの場合は 0 日", () => {
    const configs = buildSpotBusinessHoursConfigs(["spot-a"], new Map(), new Map());
    expect(countOpenBusinessDaysInRange("2026-06-01", "2026-06-03", configs)).toBe(0);
  });

  it("spot なしの場合は 0 日", () => {
    expect(countOpenBusinessDaysInRange("2026-06-01", "2026-06-03", [])).toBe(0);
  });
});

describe("isSpotOpenOnDate", () => {
  it("営業時間未設定は営業日に含めない", () => {
    expect(isSpotOpenOnDate([], [], "2026-06-01")).toBe(false);
  });
});

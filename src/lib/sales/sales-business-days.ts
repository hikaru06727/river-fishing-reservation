import {
  getEffectiveBusinessHoursForDate,
  type DateExceptionInput,
  type WeeklyHourInput,
} from "@/lib/business-hours/effective-hours";
import { toISODate } from "@/lib/utils/date";

export type SpotBusinessHoursConfig = {
  spotId: string;
  weeklyHours: WeeklyHourInput[];
  exceptions: DateExceptionInput[];
};

/** 期間内の日付を昇順で列挙（両端含む） */
export function eachDateInRange(dateFrom: string, dateTo: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);

  while (current.getTime() <= end.getTime()) {
    dates.push(toISODate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function countCalendarDaysInRange(dateFrom: string, dateTo: string): number {
  return Math.max(1, eachDateInRange(dateFrom, dateTo).length);
}

/** spot が特定日に営業しているか（営業時間設定済みかつ isOpen） */
export function isSpotOpenOnDate(
  weeklyHours: readonly WeeklyHourInput[],
  exceptions: readonly DateExceptionInput[],
  date: string,
): boolean {
  const effective = getEffectiveBusinessHoursForDate(weeklyHours, exceptions, date);
  return effective.isConfigured && effective.isOpen;
}

/**
 * 対象 spot のうち、1つでも営業している日を営業日として数える。
 * 営業時間未設定の spot は営業日判定に寄与しない。
 */
export function countOpenBusinessDaysInRange(
  dateFrom: string,
  dateTo: string,
  spotConfigs: readonly SpotBusinessHoursConfig[],
): number {
  if (spotConfigs.length === 0) {
    return 0;
  }

  const dates = eachDateInRange(dateFrom, dateTo);
  let count = 0;

  for (const date of dates) {
    const anyOpen = spotConfigs.some((config) =>
      isSpotOpenOnDate(config.weeklyHours, config.exceptions, date),
    );
    if (anyOpen) {
      count += 1;
    }
  }

  return count;
}

export function buildSpotBusinessHoursConfigs(
  spotIds: readonly string[],
  weeklyHoursBySpotId: ReadonlyMap<string, WeeklyHourInput[]>,
  exceptionsBySpotId: ReadonlyMap<string, DateExceptionInput[]>,
): SpotBusinessHoursConfig[] {
  return spotIds.map((spotId) => ({
    spotId,
    weeklyHours: weeklyHoursBySpotId.get(spotId) ?? [],
    exceptions: exceptionsBySpotId.get(spotId) ?? [],
  }));
}

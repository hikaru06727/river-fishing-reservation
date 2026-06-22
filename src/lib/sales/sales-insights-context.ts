import type { DateExceptionInput, WeeklyHourInput } from "@/lib/business-hours/effective-hours";
import {
  findDateExceptionsBySpotIdsAndDateRange,
  findWeeklyHoursBySpotIds,
} from "@/lib/repositories/business-hours.repository";
import { findManageableSpots } from "@/lib/repositories/businesses.repository";
import {
  buildSpotBusinessHoursConfigs,
  countOpenBusinessDaysInRange,
} from "@/lib/sales/sales-business-days";
import type { SalesDateRange } from "@/lib/sales/sales-types";
import type { FishingSpotDateException, FishingSpotWeeklyHour } from "@/types/database";

function mapWeeklyHourRow(row: FishingSpotWeeklyHour): WeeklyHourInput {
  return {
    day_of_week: row.day_of_week,
    is_open: row.is_open,
    open_time: row.open_time,
    close_time: row.close_time,
    is_24_hours: row.is_24_hours,
  };
}

function mapDateExceptionRow(row: FishingSpotDateException): DateExceptionInput {
  return {
    exception_date: row.exception_date,
    is_open: row.is_open,
    open_time: row.open_time,
    close_time: row.close_time,
    is_24_hours: row.is_24_hours,
    note: row.note,
  };
}

function mapWeeklyHoursBySpotId(
  source: Map<string, FishingSpotWeeklyHour[]>,
): Map<string, WeeklyHourInput[]> {
  const result = new Map<string, WeeklyHourInput[]>();
  for (const [spotId, rows] of source) {
    result.set(spotId, rows.map(mapWeeklyHourRow));
  }
  return result;
}

function mapExceptionsBySpotId(
  source: Map<string, FishingSpotDateException[]>,
): Map<string, DateExceptionInput[]> {
  const result = new Map<string, DateExceptionInput[]>();
  for (const [spotId, rows] of source) {
    result.set(spotId, rows.map(mapDateExceptionRow));
  }
  return result;
}

export function resolveScopedSpotIdsForSales(
  isAdmin: boolean,
  assignedBusinessIds: readonly string[],
  manageableSpots: ReadonlyArray<{ id: string; business_id: string | null }>,
): string[] {
  if (isAdmin) {
    return manageableSpots.map((spot) => spot.id);
  }

  const assignedSet = new Set(assignedBusinessIds);
  return manageableSpots
    .filter((spot) => spot.business_id != null && assignedSet.has(spot.business_id))
    .map((spot) => spot.id);
}

/** 権限スコープ内の spot 営業日数（いずれか1 spot が営業している日をカウント） */
export async function resolveBusinessDayCountForSales(
  range: SalesDateRange,
  isAdmin: boolean,
  assignedBusinessIds: readonly string[],
): Promise<number> {
  let manageableSpots;
  try {
    manageableSpots = await findManageableSpots();
  } catch (error) {
    console.error(
      "[resolveBusinessDayCountForSales] manageable spots",
      error instanceof Error ? error.message : error,
    );
    return 0;
  }

  const spotIds = resolveScopedSpotIdsForSales(isAdmin, assignedBusinessIds, manageableSpots);
  if (spotIds.length === 0) {
    return 0;
  }

  let weeklyHoursBySpotId;
  let exceptionsBySpotId;
  try {
    [weeklyHoursBySpotId, exceptionsBySpotId] = await Promise.all([
      findWeeklyHoursBySpotIds(spotIds),
      findDateExceptionsBySpotIdsAndDateRange(spotIds, range.dateFrom, range.dateTo),
    ]);
  } catch (error) {
    console.error(
      "[resolveBusinessDayCountForSales] business hours",
      error instanceof Error ? error.message : error,
    );
    return 0;
  }

  const configs = buildSpotBusinessHoursConfigs(
    spotIds,
    mapWeeklyHoursBySpotId(weeklyHoursBySpotId),
    mapExceptionsBySpotId(exceptionsBySpotId),
  );

  return countOpenBusinessDaysInRange(range.dateFrom, range.dateTo, configs);
}

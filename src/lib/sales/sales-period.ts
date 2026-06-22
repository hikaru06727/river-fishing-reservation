import { toISODate } from "@/lib/utils/date";
import type { SalesDateRange } from "@/lib/sales/sales-types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && toISODate(parsed) === value;
}

export function getDefaultSalesDateRange(referenceDate: Date = new Date()): SalesDateRange {
  const today = toISODate(referenceDate);
  return { dateFrom: today, dateTo: today };
}

export function parseSalesDateRange(
  searchParams: Record<string, string | undefined>,
  referenceDate: Date = new Date(),
): SalesDateRange {
  const defaults = getDefaultSalesDateRange(referenceDate);
  const rawFrom = searchParams.dateFrom ?? searchParams.startDate;
  const rawTo = searchParams.dateTo ?? searchParams.endDate;
  const dateFrom =
    rawFrom && isValidIsoDate(rawFrom) ? rawFrom : defaults.dateFrom;
  const dateTo = rawTo && isValidIsoDate(rawTo) ? rawTo : defaults.dateTo;

  if (dateFrom <= dateTo) {
    return { dateFrom, dateTo };
  }

  return { dateFrom: dateTo, dateTo: dateFrom };
}

export type SalesPeriodPreset = "today" | "thisMonth" | "nextMonth" | "oneMonthFromStart";

export function resolveSalesPeriodPreset(
  preset: SalesPeriodPreset,
  startDate?: string,
  referenceDate: Date = new Date(),
): SalesDateRange {
  switch (preset) {
    case "today":
      return getDefaultSalesDateRange(referenceDate);
    case "thisMonth":
      return getMonthRange(referenceDate);
    case "nextMonth": {
      const next = new Date(referenceDate);
      next.setMonth(next.getMonth() + 1);
      return getMonthRange(next);
    }
    case "oneMonthFromStart": {
      const base =
        startDate && isValidIsoDate(startDate)
          ? startDate
          : toISODate(referenceDate);
      return getOneMonthRangeFrom(base);
    }
  }
}

function getMonthRange(reference: Date): SalesDateRange {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { dateFrom: toISODate(start), dateTo: toISODate(end) };
}

/** 開始日を含む1か月（翌月の前日まで） */
export function getOneMonthRangeFrom(startDate: string): SalesDateRange {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  return { dateFrom: startDate, dateTo: toISODate(end) };
}

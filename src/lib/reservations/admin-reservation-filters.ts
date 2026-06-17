import { toISODate } from "@/lib/utils/date";
import type { ReservationStatus } from "@/types/database";

export const VALID_RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "expired",
] as const satisfies readonly ReservationStatus[];

export type AdminReservationFilterInput = {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: ReservationStatus | "all";
  spotId?: string;
  page?: number;
};

const VALID_STATUS_SET = new Set<string>(["all", ...VALID_RESERVATION_STATUSES]);

export function parseReservationStatus(value?: string): ReservationStatus | "all" {
  if (value && VALID_STATUS_SET.has(value)) {
    return value as ReservationStatus | "all";
  }
  return "all";
}

export function parseAdminReservationFilters(
  searchParams: Record<string, string | undefined>,
): AdminReservationFilterInput {
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  return {
    date: searchParams.date || undefined,
    dateFrom: searchParams.dateFrom || undefined,
    dateTo: searchParams.dateTo || undefined,
    status: parseReservationStatus(searchParams.status),
    spotId: searchParams.spotId || undefined,
    page,
  };
}

/** 一覧・ページネーション用の query string 断片 */
export function buildAdminReservationSearchParams(
  filters: Partial<AdminReservationFilterInput>,
): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};

  if (filters.date) {
    params.date = filters.date;
  }
  if (filters.dateFrom) {
    params.dateFrom = filters.dateFrom;
  }
  if (filters.dateTo) {
    params.dateTo = filters.dateTo;
  }
  if (filters.status && filters.status !== "all") {
    params.status = filters.status;
  }
  if (filters.spotId) {
    params.spotId = filters.spotId;
  }
  if (filters.page && filters.page > 1) {
    params.page = String(filters.page);
  }

  return params;
}

/** 今日を含む7日間（dateFrom = 今日, dateTo = 今日+6日） */
export function getWeekDateRange(referenceDate: Date = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const start = new Date(referenceDate);
  const end = new Date(referenceDate);
  end.setDate(end.getDate() + 6);

  return {
    dateFrom: toISODate(start),
    dateTo: toISODate(end),
  };
}

/** 単一日付と期間フィルタの優先順位を解決（単日 > 期間） */
export function resolveReservationDateFilters(filters: AdminReservationFilterInput): {
  singleDate?: string;
  dateFrom?: string;
  dateTo?: string;
} {
  if (filters.date) {
    return { singleDate: filters.date };
  }

  if (filters.dateFrom || filters.dateTo) {
    return {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    };
  }

  return {};
}

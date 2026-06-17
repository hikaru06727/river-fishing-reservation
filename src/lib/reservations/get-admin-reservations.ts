import { unstable_noStore as noStore } from "next/cache";
import {
  countReservationsByDate,
  findAdminReservationDetailById,
  findAdminReservationsPaginated,
  findAllReservationStatuses,
  findRecentAdminReservations,
  findTodayReservationSummaryRows,
} from "@/lib/repositories/reservations.repository";
import { findManageableSpots, type ManageableSpotRow } from "@/lib/repositories/businesses.repository";
import { toISODate } from "@/lib/utils/date";
import {
  type AdminReservationFilterInput,
  resolveReservationDateFilters,
} from "@/lib/reservations/admin-reservation-filters";
import {
  normalizeReservationPayments,
  resolveReservationPaymentStatus,
} from "@/lib/reservations/payment-status-display";
import type { PaymentMethod } from "@/lib/reservations/payment-method";
import type { PaymentStatus, ReservationStatus } from "@/types/database";

export const ADMIN_RESERVATIONS_PAGE_SIZE = 15;

export type AdminReservationRow = {
  id: string;
  payment_method: PaymentMethod;
  reservation_date: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  status: ReservationStatus;
  total_amount_yen: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  stripe_checkout_session_id: string | null;
  plans: { name: string } | null;
  profiles: { full_name: string | null; email: string } | null;
  fishing_spots: { name: string; slug: string; business_id: string | null } | null;
  payments: Array<{
    status: PaymentStatus;
    amount_yen: number;
    paid_at: string | null;
    created_at: string;
  }> | null;
  payment_status: PaymentStatus | null;
};

export type AdminReservationFilters = AdminReservationFilterInput;

export type AdminReservationsResult = {
  reservations: AdminReservationRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type TodayReservationSummary = {
  totalReservations: number;
  totalGuests: number;
  expectedRevenue: number;
};

export type ReservationStatusCounts = Record<ReservationStatus, number>;

export type ManageableSpot = ManageableSpotRow;

export type AdminReservationDetail = AdminReservationRow & {
  user_id: string;
  spot_id: string;
  plan_id: string;
  slot_id: string;
};

function enrichReservationRow(
  row: Omit<AdminReservationRow, "payment_status">,
): AdminReservationRow {
  const payments = normalizeReservationPayments(row.payments);

  return {
    ...row,
    payments: payments.length > 0 ? payments : null,
    payment_status: resolveReservationPaymentStatus(payments),
  };
}

export async function getAdminReservations(
  filters: AdminReservationFilters = {},
): Promise<AdminReservationsResult> {
  noStore();

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = ADMIN_RESERVATIONS_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const dateFilters = resolveReservationDateFilters(filters);

  try {
    const { rows, totalCount } = await findAdminReservationsPaginated({
      singleDate: dateFilters.singleDate,
      dateFrom: dateFilters.dateFrom,
      dateTo: dateFilters.dateTo,
      status: filters.status && filters.status !== "all" ? filters.status : undefined,
      spotId: filters.spotId,
      from,
      to,
    });

    const typedRows = rows as unknown as Omit<AdminReservationRow, "payment_status">[];

    return {
      reservations: typedRows.map(enrichReservationRow),
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  } catch (error) {
    console.error("[getAdminReservations]", error instanceof Error ? error.message : error);
    throw new Error("予約一覧の取得に失敗しました。");
  }
}

export async function getAdminReservationById(
  id: string,
): Promise<AdminReservationDetail | null> {
  noStore();

  try {
    const data = await findAdminReservationDetailById(id);

    if (!data) {
      return null;
    }

    const row = data as unknown as Omit<AdminReservationDetail, "payment_status">;
    return enrichReservationRow(row) as AdminReservationDetail;
  } catch (error) {
    console.error("[getAdminReservationById]", error instanceof Error ? error.message : error);
    throw new Error("予約詳細の取得に失敗しました。");
  }
}

export async function getTodayReservationSummary(): Promise<TodayReservationSummary> {
  noStore();

  const today = toISODate(new Date());

  try {
    const rows = await findTodayReservationSummaryRows(today);

    return {
      totalReservations: rows.length,
      totalGuests: rows.reduce((sum, row) => sum + row.guest_count, 0),
      expectedRevenue: rows.reduce((sum, row) => sum + row.total_amount_yen, 0),
    };
  } catch (error) {
    console.error(
      "[getTodayReservationSummary]",
      error instanceof Error ? error.message : error,
    );
    throw new Error("本日のサマリー取得に失敗しました。");
  }
}

export async function getReservationStatusCounts(): Promise<ReservationStatusCounts> {
  noStore();

  try {
    const statuses = await findAllReservationStatuses();

    const counts: ReservationStatusCounts = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      expired: 0,
    };

    for (const status of statuses) {
      if (status in counts) {
        counts[status] += 1;
      }
    }

    return counts;
  } catch (error) {
    console.error(
      "[getReservationStatusCounts]",
      error instanceof Error ? error.message : error,
    );
    throw new Error("ステータス集計の取得に失敗しました。");
  }
}

export async function getRecentAdminReservations(
  limit = 10,
): Promise<AdminReservationRow[]> {
  noStore();

  try {
    const rows = await findRecentAdminReservations(limit);
    const typedRows = rows as unknown as Omit<AdminReservationRow, "payment_status">[];
    return typedRows.map(enrichReservationRow);
  } catch (error) {
    console.error(
      "[getRecentAdminReservations]",
      error instanceof Error ? error.message : error,
    );
    throw new Error("直近予約の取得に失敗しました。");
  }
}

export async function getManageableSpots(): Promise<ManageableSpot[]> {
  noStore();

  try {
    return await findManageableSpots();
  } catch (error) {
    console.error("[getManageableSpots]", error instanceof Error ? error.message : error);
    throw new Error("釣り場一覧の取得に失敗しました。");
  }
}

export async function getTodayReservationCount(): Promise<number> {
  noStore();

  const today = toISODate(new Date());

  try {
    return await countReservationsByDate(today);
  } catch (error) {
    console.error(
      "[getTodayReservationCount]",
      error instanceof Error ? error.message : error,
    );
    throw new Error("本日の予約件数取得に失敗しました。");
  }
}

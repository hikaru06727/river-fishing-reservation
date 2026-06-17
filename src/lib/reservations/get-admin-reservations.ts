import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/utils/date";
import {
  type AdminReservationFilterInput,
  resolveReservationDateFilters,
} from "@/lib/reservations/admin-reservation-filters";
import { resolveReservationPaymentStatus } from "@/lib/reservations/payment-status-display";
import type { PaymentStatus, ReservationStatus } from "@/types/database";

export const ADMIN_RESERVATIONS_PAGE_SIZE = 15;

const RESERVATION_LIST_SELECT = `
  id,
  reservation_date,
  start_time,
  end_time,
  guest_count,
  status,
  total_amount_yen,
  created_at,
  updated_at,
  expires_at,
  stripe_checkout_session_id,
  plans ( name ),
  profiles ( full_name, email ),
  fishing_spots ( name, slug, business_id ),
  payments ( status, amount_yen, paid_at, created_at )
`;

export type AdminReservationRow = {
  id: string;
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

export type ManageableSpot = {
  id: string;
  name: string;
  business_id: string | null;
  is_active: boolean;
};

export type AdminReservationDetail = AdminReservationRow & {
  user_id: string;
  spot_id: string;
  plan_id: string;
  slot_id: string;
};

function enrichReservationRow(
  row: Omit<AdminReservationRow, "payment_status">,
): AdminReservationRow {
  return {
    ...row,
    payment_status: resolveReservationPaymentStatus(row.payments),
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

  const supabase = await createClient();
  const dateFilters = resolveReservationDateFilters(filters);

  let query = supabase
    .from("reservations")
    .select(RESERVATION_LIST_SELECT, { count: "exact" })
    .order("reservation_date", { ascending: false })
    .order("start_time", { ascending: false })
    .order("created_at", { ascending: false });

  if (dateFilters.singleDate) {
    query = query.eq("reservation_date", dateFilters.singleDate);
  } else {
    if (dateFilters.dateFrom) {
      query = query.gte("reservation_date", dateFilters.dateFrom);
    }
    if (dateFilters.dateTo) {
      query = query.lte("reservation_date", dateFilters.dateTo);
    }
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.spotId) {
    query = query.eq("spot_id", filters.spotId);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("[getAdminReservations]", error.message);
    throw new Error("予約一覧の取得に失敗しました。");
  }

  const totalCount = count ?? 0;
  const rows = (data ?? []) as unknown as Omit<AdminReservationRow, "payment_status">[];

  return {
    reservations: rows.map(enrichReservationRow),
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export async function getAdminReservationById(
  id: string,
): Promise<AdminReservationDetail | null> {
  noStore();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      *,
      plans ( name ),
      profiles ( full_name, email ),
      fishing_spots ( name, slug, business_id ),
      payments ( status, amount_yen, paid_at, created_at, stripe_payment_intent_id, stripe_checkout_session_id )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[getAdminReservationById]", error.message);
    throw new Error("予約詳細の取得に失敗しました。");
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as Omit<AdminReservationDetail, "payment_status">;
  return enrichReservationRow(row) as AdminReservationDetail;
}

export async function getTodayReservationSummary(): Promise<TodayReservationSummary> {
  noStore();

  const today = toISODate(new Date());
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select("guest_count, total_amount_yen, status")
    .eq("reservation_date", today)
    .in("status", ["pending", "confirmed"]);

  if (error) {
    console.error("[getTodayReservationSummary]", error.message);
    throw new Error("本日のサマリー取得に失敗しました。");
  }

  type SummaryRow = Pick<
    AdminReservationRow,
    "guest_count" | "total_amount_yen" | "status"
  >;
  const rows = (data ?? []) as SummaryRow[];

  return {
    totalReservations: rows.length,
    totalGuests: rows.reduce((sum, row) => sum + row.guest_count, 0),
    expectedRevenue: rows.reduce((sum, row) => sum + row.total_amount_yen, 0),
  };
}

export async function getReservationStatusCounts(): Promise<ReservationStatusCounts> {
  noStore();

  const supabase = await createClient();
  const { data, error } = await supabase.from("reservations").select("status");

  if (error) {
    console.error("[getReservationStatusCounts]", error.message);
    throw new Error("ステータス集計の取得に失敗しました。");
  }

  const counts: ReservationStatusCounts = {
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    expired: 0,
  };

  for (const row of data ?? []) {
    const status = row.status as ReservationStatus;
    if (status in counts) {
      counts[status] += 1;
    }
  }

  return counts;
}

export async function getRecentAdminReservations(
  limit = 10,
): Promise<AdminReservationRow[]> {
  noStore();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getRecentAdminReservations]", error.message);
    throw new Error("直近予約の取得に失敗しました。");
  }

  const rows = (data ?? []) as unknown as Omit<AdminReservationRow, "payment_status">[];
  return rows.map(enrichReservationRow);
}

export async function getManageableSpots(): Promise<ManageableSpot[]> {
  noStore();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spots")
    .select("id, name, business_id, is_active")
    .order("name");

  if (error) {
    console.error("[getManageableSpots]", error.message);
    throw new Error("釣り場一覧の取得に失敗しました。");
  }

  return (data ?? []) as ManageableSpot[];
}

export async function getTodayReservationCount(): Promise<number> {
  noStore();

  const today = toISODate(new Date());
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("reservation_date", today);

  if (error) {
    console.error("[getTodayReservationCount]", error.message);
    throw new Error("本日の予約件数取得に失敗しました。");
  }

  return count ?? 0;
}

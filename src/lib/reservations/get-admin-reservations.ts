import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/utils/date";
import type { ReservationStatus } from "@/types/database";

export const ADMIN_RESERVATIONS_PAGE_SIZE = 15;

export type AdminReservationRow = {
  id: string;
  reservation_date: string;
  start_time: string;
  guest_count: number;
  status: ReservationStatus;
  total_amount_yen: number;
  created_at: string;
  plans: { name: string } | null;
  profiles: { full_name: string | null; email: string } | null;
};

export type AdminReservationFilters = {
  date?: string;
  status?: ReservationStatus | "all";
  page?: number;
};

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

export async function getAdminReservations(
  filters: AdminReservationFilters = {},
): Promise<AdminReservationsResult> {
  noStore();

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = ADMIN_RESERVATIONS_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("reservations")
    .select(
      `
      id,
      reservation_date,
      start_time,
      guest_count,
      status,
      total_amount_yen,
      created_at,
      plans ( name ),
      profiles ( full_name, email )
    `,
      { count: "exact" },
    )
    .order("reservation_date", { ascending: true })
    .order("start_time", { ascending: true })
    .range(from, to);

  if (filters.date) {
    query = query.eq("reservation_date", filters.date);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[getAdminReservations]", error.message);
    throw new Error("予約一覧の取得に失敗しました。");
  }

  const totalCount = count ?? 0;

  return {
    reservations: (data ?? []) as AdminReservationRow[],
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
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

  const rows = data ?? [];

  return {
    totalReservations: rows.length,
    totalGuests: rows.reduce((sum, row) => sum + row.guest_count, 0),
    expectedRevenue: rows.reduce((sum, row) => sum + row.total_amount_yen, 0),
  };
}

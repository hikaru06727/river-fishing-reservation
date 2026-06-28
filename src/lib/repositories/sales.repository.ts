import { createClient } from "@/lib/supabase/server";
import { inferPaymentMethod } from "@/lib/reservations/payment-method";
import type { PaymentMethod } from "@/lib/reservations/payment-method";
import type { PaymentStatus, ReservationStatus } from "@/types/database";
import type { SalesDateRange, SalesReservationRow, TodaySalesRawRow } from "@/lib/sales/sales-types";

const SALES_RESERVATION_SELECT = `
  id,
  reservation_date,
  status,
  payment_method,
  guest_count,
  total_amount_yen,
  reserved_plan_name,
  reserved_unit_price_yen,
  locations (
    business_id
  ),
  payments ( status, amount_yen )
`;

type SalesReservationDbRow = {
  id: string;
  reservation_date: string;
  status: ReservationStatus;
  payment_method: string | null;
  guest_count: number;
  total_amount_yen: number;
  reserved_plan_name: string | null;
  reserved_unit_price_yen: number | null;
  locations:
    | { business_id: string | null }
    | Array<{ business_id: string | null }>
    | null;
  payments:
    | { status: PaymentStatus; amount_yen: number }
    | Array<{ status: PaymentStatus; amount_yen: number }>
    | null;
};

async function fetchBusinessNameMap(businessIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(businessIds.filter((id) => id.length > 0))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((row) => [row.id, row.name]));
}

function resolveEmbeddedSpot(
  locations: SalesReservationDbRow["locations"],
): { business_id: string | null } {
  if (locations == null) {
    return { business_id: null };
  }

  const spot = Array.isArray(locations) ? locations[0] : locations;
  return { business_id: spot?.business_id ?? null };
}

function mapSalesReservationRow(
  row: SalesReservationDbRow,
  businessNameMap: Map<string, string>,
): SalesReservationRow {
  const spot = resolveEmbeddedSpot(row.locations);
  const businessName =
    spot.business_id != null ? (businessNameMap.get(spot.business_id) ?? null) : null;

  return {
    id: row.id,
    reservation_date: row.reservation_date,
    status: row.status,
    payment_method: inferPaymentMethod({
      payment_method: row.payment_method as PaymentMethod | null,
    }),
    guest_count: row.guest_count,
    total_amount_yen: row.total_amount_yen,
    reserved_plan_name: row.reserved_plan_name,
    reserved_unit_price_yen: row.reserved_unit_price_yen,
    business_id: spot.business_id,
    business_name: businessName,
    payments: row.payments,
  };
}

/**
 * 期間内の POS 販売合計（税込み）を取得
 * payment_ledger の source_type='pos' エントリを集計し、RLS でアクセス制御する
 */
export async function findProductSalesTotalYen(range: SalesDateRange): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_ledger")
    .select("amount")
    .eq("source_type", "pos")
    .eq("status", "succeeded")
    .gte("paid_at", range.dateFrom + "T00:00:00+09:00")
    .lte("paid_at", range.dateTo + "T23:59:59+09:00");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
}

/**
 * 指定 JST 日付の精算済み売上行を取得（payment_ledger から集計）
 * payment_method は payment_ledger でバケット済み: cash / card / other
 */
export async function findTodaySalesRows(dateJst: string): Promise<TodaySalesRawRow[]> {
  const supabase = await createClient();
  const jstStart = `${dateJst}T00:00:00+09:00`;
  const jstEnd = `${dateJst}T23:59:59+09:00`;

  const { data, error } = await supabase
    .from("payment_ledger")
    .select("amount, payment_method")
    .eq("status", "succeeded")
    .gte("paid_at", jstStart)
    .lte("paid_at", jstEnd);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    amountYen: row.amount,
    paymentMethod: row.payment_method,
  }));
}

/** 期間内の予約行を取得（管理画面・RLS 下） */
export async function findSalesReservationRows(
  range: SalesDateRange,
): Promise<SalesReservationRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(SALES_RESERVATION_SELECT)
    .gte("reservation_date", range.dateFrom)
    .lte("reservation_date", range.dateTo)
    .order("reservation_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const dbRows = (data ?? []) as unknown as SalesReservationDbRow[];
  const businessIds = dbRows
    .map((row) => resolveEmbeddedSpot(row.locations).business_id)
    .filter((id): id is string => id != null);
  const businessNameMap = await fetchBusinessNameMap(businessIds);

  return dbRows.map((row) => mapSalesReservationRow(row, businessNameMap));
}

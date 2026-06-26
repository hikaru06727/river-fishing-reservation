import { createClient } from "@/lib/supabase/server";
import type {
  RegisterClosingCorrectionRow,
  RegisterClosingRow,
} from "@/types/database";
import type { RegisterClosingStatus } from "@/types/domain";

export type InsertRegisterClosingInput = {
  business_id: string;
  location_id?: string | null;
  closed_by: string;
  period_start: string;
  period_end: string;
  total_cash: number;
  total_card: number;
  total_other: number;
  total_amount: number;
  note?: string | null;
};

export type InsertCorrectionInput = {
  closing_id: string;
  requested_by: string;
  reason: string;
};

export type ClosingWithCloserName = RegisterClosingRow & {
  closer_name: string | null;
  closer_email: string;
};

/** 指定 business の締め記録を新しい順で取得 */
export async function findClosingsByBusinessId(
  businessId: string,
  limit = 50,
  offset = 0,
): Promise<{ data: RegisterClosingRow[]; count: number }> {
  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("register_closings")
    .select("*", { count: "exact" })
    .eq("business_id", businessId)
    .order("closed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(error.message);
  }

  return { data: (data ?? []) as RegisterClosingRow[], count: count ?? 0 };
}

/** ID で締め記録を取得 */
export async function findClosingById(
  id: string,
): Promise<RegisterClosingRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("register_closings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as RegisterClosingRow | null;
}

/** 指定 business の最後の締め記録を取得 */
export async function findLastClosingByBusinessId(
  businessId: string,
): Promise<RegisterClosingRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("register_closings")
    .select("*")
    .eq("business_id", businessId)
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as RegisterClosingRow | null;
}

/** 締め記録を作成 */
export async function insertRegisterClosing(
  input: InsertRegisterClosingInput,
): Promise<RegisterClosingRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("register_closings")
    .insert({
      business_id: input.business_id,
      location_id: input.location_id ?? null,
      closed_by: input.closed_by,
      period_start: input.period_start,
      period_end: input.period_end,
      total_cash: input.total_cash,
      total_card: input.total_card,
      total_other: input.total_other,
      total_amount: input.total_amount,
      note: input.note ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as RegisterClosingRow;
}

/** 締め記録のステータスを更新 */
export async function updateClosingStatus(
  id: string,
  status: RegisterClosingStatus,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("register_closings")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

/** 修正リクエストを作成 */
export async function insertCorrectionRequest(
  input: InsertCorrectionInput,
): Promise<RegisterClosingCorrectionRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("register_closing_corrections")
    .insert({
      closing_id: input.closing_id,
      requested_by: input.requested_by,
      reason: input.reason,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as RegisterClosingCorrectionRow;
}

/** 指定締め記録の修正リクエスト一覧 */
export async function findCorrectionsByClosingId(
  closingId: string,
): Promise<RegisterClosingCorrectionRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("register_closing_corrections")
    .select("*")
    .eq("closing_id", closingId)
    .order("requested_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RegisterClosingCorrectionRow[];
}

/** 指定 business の pending 修正リクエストを取得（承認待ち） */
export async function findPendingCorrectionsByBusinessId(
  businessId: string,
): Promise<RegisterClosingCorrectionRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("register_closing_corrections")
    .select("*, register_closings!inner(business_id)")
    .eq("status", "pending")
    .eq("register_closings.business_id", businessId)
    .order("requested_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RegisterClosingCorrectionRow[];
}

/** 修正リクエストのステータスを更新（承認 / 却下） */
export async function updateCorrectionStatus(
  id: string,
  status: "approved" | "rejected",
  approvedBy: string,
): Promise<RegisterClosingCorrectionRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("register_closing_corrections")
    .update({
      status,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as RegisterClosingCorrectionRow;
}

/** ID で修正リクエストを取得 */
export async function findCorrectionById(
  id: string,
): Promise<RegisterClosingCorrectionRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("register_closing_corrections")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as RegisterClosingCorrectionRow | null;
}

/**
 * 指定された sold_at が含まれる締め済み期間を返す。
 * status が closed / correction_requested / approved のいずれかなら「締め済み」とみなす。
 */
export async function findClosingContainingSoldAt(
  businessId: string,
  soldAt: string,
): Promise<RegisterClosingRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("register_closings")
    .select("*")
    .eq("business_id", businessId)
    .lte("period_start", soldAt)
    .gte("period_end", soldAt)
    .in("status", ["closed", "correction_requested", "approved"])
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as RegisterClosingRow | null;
}

/** 期間内の売上集計に使う生データを取得（締め処理用） */
export type ClosingSalesRawRow = {
  amountYen: number;
  paymentMethod: string | null;
};

export async function findSalesRowsForClosing(params: {
  businessId: string;
  periodStartIso: string;
  periodEndIso: string;
}): Promise<ClosingSalesRawRow[]> {
  const supabase = await createClient();
  const { businessId, periodStartIso, periodEndIso } = params;

  const periodStartDate = periodStartIso.split("T")[0]!;
  const periodEndDate = periodEndIso.split("T")[0]!;

  const [resResult, manualResult, productResult, posResult] = await Promise.all([
    supabase
      .from("reservations")
      .select("total_amount_yen, reserved_unit_price_yen, guest_count, payment_method, locations!inner(business_id)")
      .eq("status", "confirmed")
      .gte("reservation_date", periodStartDate)
      .lte("reservation_date", periodEndDate),
    supabase
      .from("manual_sales")
      .select("amount_yen, payment_method")
      .eq("business_id", businessId)
      .gte("sale_date", periodStartDate)
      .lte("sale_date", periodEndDate),
    supabase
      .from("product_sales")
      .select("quantity, unit_price_excluding_tax, payment_method")
      .eq("business_id", businessId)
      .eq("status", "completed")
      .is("sale_session_id", null)
      .gte("purchased_at", periodStartIso)
      .lte("purchased_at", periodEndIso),
    supabase
      .from("sale_sessions")
      .select("total_amount, payment_method")
      .eq("business_id", businessId)
      .gte("sold_at", periodStartIso)
      .lte("sold_at", periodEndIso),
  ]);

  if (resResult.error) throw new Error(resResult.error.message);
  if (manualResult.error) throw new Error(manualResult.error.message);
  if (productResult.error) throw new Error(productResult.error.message);
  if (posResult.error) throw new Error(posResult.error.message);

  const rows: ClosingSalesRawRow[] = [];

  for (const r of resResult.data ?? []) {
    const loc = Array.isArray(r.locations) ? r.locations[0] : r.locations;
    if (!loc || (loc as { business_id: string | null }).business_id !== businessId) continue;
    const amount =
      r.reserved_unit_price_yen != null
        ? r.reserved_unit_price_yen * r.guest_count
        : r.total_amount_yen;
    rows.push({ amountYen: amount, paymentMethod: r.payment_method });
  }

  for (const r of manualResult.data ?? []) {
    rows.push({ amountYen: r.amount_yen, paymentMethod: r.payment_method });
  }

  for (const r of productResult.data ?? []) {
    rows.push({
      amountYen: r.quantity * r.unit_price_excluding_tax,
      paymentMethod: r.payment_method,
    });
  }

  for (const r of posResult.data ?? []) {
    rows.push({ amountYen: r.total_amount, paymentMethod: r.payment_method });
  }

  return rows;
}

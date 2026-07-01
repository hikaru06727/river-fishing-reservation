import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

/**
 * 指定された reservation_date が含まれる締め済み期間を返す。
 * findSalesRowsForClosing が日付文字列（DATE）で予約を照合するのと同じロジックで
 * period_start::date <= reservationDate <= period_end::date を満たす締め記録を探す。
 * UTC 日付オーバーラップ判定：
 *   period_start <= reservationDate T23:59:59Z
 *   period_end   >= reservationDate T00:00:00Z
 */
export async function findClosingContainingReservationDate(
  businessId: string,
  reservationDate: string,
): Promise<RegisterClosingRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("register_closings")
    .select("*")
    .eq("business_id", businessId)
    .lte("period_start", `${reservationDate}T23:59:59Z`)
    .gte("period_end", `${reservationDate}T00:00:00Z`)
    .in("status", ["closed", "correction_requested", "approved"])
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as RegisterClosingRow | null;
}

/** 締め後返金差分カラムを加算更新（service_role で RLS をバイパス） */
export async function updatePostCloseRefund(params: {
  closingId: string;
  paymentMethod: "cash" | "card" | "other";
  amount: number;
}): Promise<void> {
  const supabase = createAdminClient();
  const { closingId, paymentMethod, amount } = params;

  const { data: current, error: fetchErr } = await supabase
    .from("register_closings")
    .select(
      "post_close_refund_cash, post_close_refund_card, post_close_refund_other, post_close_refund_total",
    )
    .eq("id", closingId)
    .single();

  if (fetchErr) throw new Error(fetchErr.message);

  const patch: {
    post_close_refund_cash?: number;
    post_close_refund_card?: number;
    post_close_refund_other?: number;
    post_close_refund_total: number;
  } = {
    post_close_refund_total: Number(current.post_close_refund_total) + amount,
  };

  if (paymentMethod === "cash") {
    patch.post_close_refund_cash = Number(current.post_close_refund_cash) + amount;
  } else if (paymentMethod === "card") {
    patch.post_close_refund_card = Number(current.post_close_refund_card) + amount;
  } else {
    patch.post_close_refund_other = Number(current.post_close_refund_other) + amount;
  }

  const { error } = await supabase
    .from("register_closings")
    .update(patch)
    .eq("id", closingId);

  if (error) throw new Error(error.message);
}

export type ClosedPeriod = {
  period_start: string;
  period_end: string;
};

/** 締め済み期間の一覧を取得（販売履歴の未締めフィルタ・バッジ表示用） */
export async function findClosedPeriodsByBusinessId(
  businessId: string,
): Promise<ClosedPeriod[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("register_closings")
    .select("period_start, period_end")
    .eq("business_id", businessId)
    .in("status", ["closed", "correction_requested", "approved"]);

  if (error) throw new Error(error.message);
  return (data ?? []) as ClosedPeriod[];
}

/** 期間内の売上集計に使う生データを取得（締め処理用） */
export type ClosingSalesRawRow = {
  amountYen: number;
  paymentMethod: string | null;
};

/**
 * payment_ledger の succeeded エントリを返す（締め集計用）。
 * payment_method は既に cash/card/other にバケット済み。
 */
export async function findSalesRowsForClosing(params: {
  businessId: string;
  periodStartIso: string;
  periodEndIso: string;
}): Promise<ClosingSalesRawRow[]> {
  const supabase = await createClient();
  const { businessId, periodStartIso, periodEndIso } = params;

  const { data, error } = await supabase
    .from("payment_ledger")
    .select("amount, payment_method")
    .eq("business_id", businessId)
    .eq("status", "succeeded")
    .gte("paid_at", periodStartIso)
    .lte("paid_at", periodEndIso);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    amountYen: row.amount,
    paymentMethod: row.payment_method,
  }));
}

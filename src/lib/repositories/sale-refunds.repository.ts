import { createClient } from "@/lib/supabase/server";
import type { Database, SaleRefundRow } from "@/types/database";
import type { SaleRefundPaymentMethod, SaleRefundStatus } from "@/types/domain";

export type InsertSaleRefundInput = {
  business_id: string;
  sale_session_id?: string | null;
  reservation_id?: string | null;
  stripe_refund_id?: string | null;
  stripe_payment_intent_id?: string | null;
  amount: number;
  payment_method: SaleRefundPaymentMethod;
  reason?: string | null;
  refunded_by: string;
  status?: SaleRefundStatus;
  note?: string | null;
};

/** 返金記録を作成 */
export async function insertSaleRefund(input: InsertSaleRefundInput): Promise<SaleRefundRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sale_refunds")
    .insert({
      business_id: input.business_id,
      sale_session_id: input.sale_session_id ?? null,
      reservation_id: input.reservation_id ?? null,
      stripe_refund_id: input.stripe_refund_id ?? null,
      stripe_payment_intent_id: input.stripe_payment_intent_id ?? null,
      amount: input.amount,
      payment_method: input.payment_method,
      reason: input.reason ?? null,
      refunded_by: input.refunded_by,
      status: input.status ?? "pending",
      note: input.note ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SaleRefundRow;
}

/** 返金ステータスを更新 */
export async function updateSaleRefundStatus(
  id: string,
  status: SaleRefundStatus,
  extra?: { stripe_refund_id?: string },
): Promise<void> {
  const supabase = await createClient();

  type UpdateInput = Database["public"]["Tables"]["sale_refunds"]["Update"];
  const patch: UpdateInput = { status };
  if (extra?.stripe_refund_id) patch.stripe_refund_id = extra.stripe_refund_id;

  const { error } = await supabase
    .from("sale_refunds")
    .update(patch)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

/** 事業の返金一覧（新しい順） */
export async function findRefundsByBusinessId(
  businessId: string,
  limit = 50,
  offset = 0,
): Promise<{ data: SaleRefundRow[]; count: number }> {
  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("sale_refunds")
    .select("*", { count: "exact" })
    .eq("business_id", businessId)
    .order("refunded_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(error.message);
  }

  return { data: (data ?? []) as SaleRefundRow[], count: count ?? 0 };
}

/** 予約の Stripe payment_intent_id を取得（カード返金用） */
export async function findStripePaymentIntentByReservationId(
  reservationId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select("stripe_payment_intent_id")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.stripe_payment_intent_id ?? null;
}

/** 売上セッションの合計金額を取得（返金額の上限チェック用） */
export async function findSaleSessionAmountById(
  saleSessionId: string,
): Promise<number | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sale_sessions")
    .select("total_amount")
    .eq("id", saleSessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.total_amount ?? null;
}

/** 予約の確定金額を取得（返金額の上限チェック用） */
export async function findReservationAmountById(
  reservationId: string,
): Promise<number | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select("total_amount_yen")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.total_amount_yen ?? null;
}

/** 過去の返金合計を取得（上限チェック用） */
export async function findTotalRefundedAmount(params: {
  saleSessionId?: string;
  reservationId?: string;
}): Promise<number> {
  const supabase = await createClient();

  let query = supabase
    .from("sale_refunds")
    .select("amount")
    .in("status", ["pending", "completed"]);

  if (params.saleSessionId) {
    query = query.eq("sale_session_id", params.saleSessionId);
  } else if (params.reservationId) {
    query = query.eq("reservation_id", params.reservationId);
  } else {
    return 0;
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

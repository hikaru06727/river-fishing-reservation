import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, SaleRefundRow } from "@/types/database";
import type { SaleRefundPaymentMethod, SaleRefundStatus } from "@/types/domain";

export type InsertSaleRefundInput = {
  business_id: string;
  sale_session_id?: string | null;
  reservation_id?: string | null;
  online_order_id?: string | null;
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
      online_order_id: input.online_order_id ?? null,
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

/** 特定の売上セッションに対する返金一覧（新しい順） */
export async function findRefundsBySaleSessionId(
  saleSessionId: string,
): Promise<SaleRefundRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sale_refunds")
    .select("*")
    .eq("sale_session_id", saleSessionId)
    .in("status", ["pending", "completed"])
    .order("refunded_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SaleRefundRow[];
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

/** 追加購入注文の合計金額を取得（返金額の上限チェック用。Phase 19E） */
export async function findOnlineOrderAmountById(orderId: string): Promise<number | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("online_orders")
    .select("total_amount")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.total_amount ?? null;
}

/** 追加購入注文の Stripe payment_intent_id を取得（カード返金用。Phase 19E） */
export async function findStripePaymentIntentByOnlineOrderId(
  orderId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("online_orders")
    .select("stripe_payment_intent_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.stripe_payment_intent_id ?? null;
}

/**
 * service_role での取得（予約キャンセルに伴う自動返金用。顧客自身のキャンセル
 * 操作は payments / sale_refunds への RLS アクセス権を持たないため、この
 * 一連の *Admin 関数を使う）。
 */
export async function findStripePaymentIntentByReservationIdAdmin(
  reservationId: string,
): Promise<string | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("payments")
    .select("stripe_payment_intent_id")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.stripe_payment_intent_id ?? null;
}

/**
 * 予約本体 + 有効なアドオン明細（reservation_addon_items, status='active'）の
 * 合計額（返金上限）を service_role で取得する。
 */
export async function findReservationAmountByIdAdmin(
  reservationId: string,
): Promise<number | null> {
  const admin = createAdminClient();

  const { data: reservation, error: reservationError } = await admin
    .from("reservations")
    .select("total_amount_yen")
    .eq("id", reservationId)
    .maybeSingle();

  if (reservationError) {
    throw new Error(reservationError.message);
  }
  if (!reservation) return null;

  const { data: addonItems, error: addonError } = await admin
    .from("reservation_addon_items")
    .select("unit_price, tax_rate, quantity")
    .eq("reservation_id", reservationId)
    .eq("status", "active");

  if (addonError) {
    throw new Error(addonError.message);
  }

  const addonTotal = (addonItems ?? []).reduce((sum, item) => {
    const net = item.unit_price * item.quantity;
    const tax = Math.floor((net * item.tax_rate) / 100);
    return sum + net + tax;
  }, 0);

  return reservation.total_amount_yen + addonTotal;
}

/** service_role での過去返金合計取得 */
export async function findTotalRefundedAmountAdmin(reservationId: string): Promise<number> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("sale_refunds")
    .select("amount")
    .eq("reservation_id", reservationId)
    .in("status", ["pending", "completed"]);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

/** service_role での返金記録作成（予約キャンセルに伴う自動返金用） */
export async function insertSaleRefundAdmin(input: InsertSaleRefundInput): Promise<SaleRefundRow> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("sale_refunds")
    .insert({
      business_id: input.business_id,
      sale_session_id: input.sale_session_id ?? null,
      reservation_id: input.reservation_id ?? null,
      online_order_id: input.online_order_id ?? null,
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

/** service_role での reservation_date 取得（締め後返金判定用） */
export async function findReservationDateByIdAdmin(reservationId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservations")
    .select("reservation_date")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data?.reservation_date ?? null;
}

/** 売上セッションの sold_at を取得（締め後返金判定用） */
export async function findSaleSessionSoldAtById(
  saleSessionId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sale_sessions")
    .select("sold_at")
    .eq("id", saleSessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data?.sold_at ?? null;
}

/** 予約の reservation_date を取得（締め後返金判定用） */
export async function findReservationDateById(
  reservationId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select("reservation_date")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data?.reservation_date ?? null;
}

/** 過去の返金合計を取得（上限チェック用） */
export async function findTotalRefundedAmount(params: {
  saleSessionId?: string;
  reservationId?: string;
  onlineOrderId?: string;
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
  } else if (params.onlineOrderId) {
    query = query.eq("online_order_id", params.onlineOrderId);
  } else {
    return 0;
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

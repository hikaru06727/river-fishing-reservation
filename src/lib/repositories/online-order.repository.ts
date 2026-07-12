import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { computePickupDeadline, getJstDayRangeUtc } from "@/lib/online-orders/pickup-schedule";
import type { OnlineOrderItemRow, OnlineOrderRow } from "@/types/database";
import type {
  OnlineOrderFulfillmentType,
  OnlineOrderPaymentMethod,
  OnlineOrderPaymentStatus,
  OnlineOrderStatus,
} from "@/types/domain";

export type InsertOnlineOrderInput = {
  business_id: string;
  fulfillment_type: OnlineOrderFulfillmentType;
  payment_method: OnlineOrderPaymentMethod;
  status?: OnlineOrderStatus;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  shipping_postal_code?: string | null;
  shipping_prefecture?: string | null;
  shipping_address_line1?: string | null;
  shipping_address_line2?: string | null;
  notes?: string | null;
  /** 店舗受け取りの希望日時（ISO文字列）。指定時は pickup_deadline（+3日）を自動算出する */
  pickup_date?: string | null;
  /** 予約後の追加購入の場合に紐づく予約ID（Phase 19E） */
  linked_reservation_id?: string | null;
};

function generateConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export type InsertOnlineOrderItemInput = {
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  tax_rate: number;
  quantity: number;
};

/**
 * ゲスト顧客（auth.uid() なし）が注文するため service_role で作成する
 * （reservations と同じパターン。anon への直接 INSERT RLS は付与しない）。
 */
export async function createOnlineOrder(input: InsertOnlineOrderInput): Promise<OnlineOrderRow> {
  const admin = createAdminClient();

  const pickupDeadline = input.pickup_date
    ? computePickupDeadline(new Date(input.pickup_date)).toISOString()
    : null;

  const { data, error } = await admin
    .from("online_orders")
    .insert({
      business_id: input.business_id,
      fulfillment_type: input.fulfillment_type,
      payment_method: input.payment_method,
      status: input.status ?? "pending_payment",
      subtotal_amount: input.subtotal_amount,
      tax_amount: input.tax_amount,
      total_amount: input.total_amount,
      customer_name: input.customer_name,
      customer_email: input.customer_email,
      customer_phone: input.customer_phone ?? null,
      shipping_postal_code: input.shipping_postal_code ?? null,
      shipping_prefecture: input.shipping_prefecture ?? null,
      shipping_address_line1: input.shipping_address_line1 ?? null,
      shipping_address_line2: input.shipping_address_line2 ?? null,
      notes: input.notes ?? null,
      pickup_date: input.pickup_date ?? null,
      pickup_deadline: pickupDeadline,
      confirmation_code: generateConfirmationCode(),
      linked_reservation_id: input.linked_reservation_id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as OnlineOrderRow;
}

export async function createOnlineOrderItems(
  items: InsertOnlineOrderItemInput[],
): Promise<OnlineOrderItemRow[]> {
  if (items.length === 0) return [];
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("online_order_items")
    .insert(
      items.map((item) => ({
        order_id: item.order_id,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        quantity: item.quantity,
      })),
    )
    .select();

  if (error) throw new Error(error.message);
  return (data ?? []) as OnlineOrderItemRow[];
}

/** 注文完了ページ・Webhook 用。business_id で絞り込み、他事業の注文は返さない */
export async function findOnlineOrderById(
  id: string,
  businessId: string,
): Promise<OnlineOrderRow | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("online_orders")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as OnlineOrderRow | null;
}

export async function findOnlineOrderItemsByOrderId(
  orderId: string,
): Promise<OnlineOrderItemRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("online_order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as OnlineOrderItemRow[];
}

/** Stripe Checkout Session 作成後に session_id を保存する */
export async function updateOnlineOrderStripeSession(
  id: string,
  stripeCheckoutSessionId: string,
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("online_orders")
    .update({ stripe_checkout_session_id: stripeCheckoutSessionId })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function updateOnlineOrderStatus(
  id: string,
  status: OnlineOrderStatus,
): Promise<void> {
  const admin = createAdminClient();

  const update: { status: OnlineOrderStatus; shipped_at?: string; delivered_at?: string } = {
    status,
  };
  if (status === "shipped") {
    update.shipped_at = new Date().toISOString();
  }
  if (status === "delivered") {
    update.delivered_at = new Date().toISOString();
  }

  const { error } = await admin.from("online_orders").update(update).eq("id", id);

  if (error) throw new Error(error.message);
}

/** Stripe Webhook（checkout.session.completed）確定時に payment_intent_id を保存する（カード返金用） */
export async function updateOnlineOrderStripePaymentIntent(
  id: string,
  stripePaymentIntentId: string,
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("online_orders")
    .update({ stripe_payment_intent_id: stripePaymentIntentId })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function updateOnlineOrderPaymentStatus(
  id: string,
  paymentStatus: OnlineOrderPaymentStatus,
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("online_orders")
    .update({ payment_status: paymentStatus })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export type OnlineOrderFilters = {
  status?: OnlineOrderStatus;
  fulfillmentType?: OnlineOrderFulfillmentType;
  paymentMethod?: OnlineOrderPaymentMethod;
};

/**
 * 管理画面の注文一覧用。セッション付き RLS クライアントを使い、
 * business_id の明示的な絞り込みと合わせて二重に権限を担保する。
 */
export async function findOnlineOrdersByBusiness(
  businessId: string,
  filters: OnlineOrderFilters = {},
): Promise<OnlineOrderRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("online_orders")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.fulfillmentType) {
    query = query.eq("fulfillment_type", filters.fulfillmentType);
  }
  if (filters.paymentMethod) {
    query = query.eq("payment_method", filters.paymentMethod);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as OnlineOrderRow[];
}

/**
 * 管理画面の注文詳細用。RLS クライアントを使うため、
 * admin/business_admin/staff の閲覧範囲外の注文は返らない。
 */
export async function findOnlineOrderByIdForAdmin(id: string): Promise<OnlineOrderRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("online_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as OnlineOrderRow | null;
}

/** ページレベル認可チェック用。business_id のみを取得する軽量な問い合わせ */
export async function findOnlineOrderBusinessId(id: string): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("online_orders")
    .select("business_id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.business_id ?? null;
}

/**
 * 指定 JST 暦日が pickup_date の注文一覧（管理画面「本日の受け取り予定」用）。
 * 将来のカレンダー機能（Phase 17〜18）でも再利用できるよう独立した関数にしてある。
 */
export async function findOrdersByPickupDate(
  businessId: string,
  date: Date,
): Promise<OnlineOrderRow[]> {
  const supabase = await createClient();

  const isoDate = date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const { startUtc, endUtc } = getJstDayRangeUtc(isoDate);

  const { data, error } = await supabase
    .from("online_orders")
    .select("*")
    .eq("business_id", businessId)
    .gte("pickup_date", startUtc)
    .lt("pickup_date", endUtc)
    .order("pickup_date", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as OnlineOrderRow[]).filter(
    (o) => o.status !== "cancelled" && o.status !== "delivered",
  );
}

/**
 * 受け取り期限切れの店舗受け取り注文（cron による自動キャンセル用）。
 * service_role を使うためユーザーセッションに依存しない。
 */
export async function findExpiredPickupOrders(): Promise<OnlineOrderRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("online_orders")
    .select("*")
    .lt("pickup_deadline", new Date().toISOString())
    .in("status", ["paid", "preparing", "ready"]);

  if (error) throw new Error(error.message);
  return (data ?? []) as OnlineOrderRow[];
}

/**
 * 予約に紐づく追加購入注文の一覧（Phase 19E）。予約詳細ページ（顧客・管理画面
 * どちらも）から呼ぶため、呼び出し元で予約への閲覧権限を確認済みであることを前提に
 * service_role で取得する（online_orders の RLS は staff/business_admin/admin のみ
 * カバーしており、予約の所有者である一般顧客はこの経路では読めないため）。
 */
export async function findOrdersByLinkedReservationIdAdmin(
  reservationId: string,
): Promise<OnlineOrderRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("online_orders")
    .select("*")
    .eq("linked_reservation_id", reservationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as OnlineOrderRow[];
}

/**
 * Stripe Webhook からの検索用。checkout.session.completed イベントには
 * business_id が含まれないため session_id のみで検索する。
 */
export async function findOnlineOrderByStripeSessionId(
  stripeCheckoutSessionId: string,
): Promise<OnlineOrderRow | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("online_orders")
    .select("*")
    .eq("stripe_checkout_session_id", stripeCheckoutSessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as OnlineOrderRow | null;
}

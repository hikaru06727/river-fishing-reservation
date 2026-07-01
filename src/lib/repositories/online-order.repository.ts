import { createAdminClient } from "@/lib/supabase/admin";
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
};

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

  const { error } = await admin.from("online_orders").update({ status }).eq("id", id);

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

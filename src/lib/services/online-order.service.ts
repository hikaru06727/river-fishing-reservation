import Stripe from "stripe";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { getUser } from "@/lib/auth/get-user";
import { isAdminRole, isStaffRole } from "@/lib/auth/role";
import { hasPermission } from "@/lib/permissions";
import {
  sendOnlineOrderConfirmationEmail,
  sendOnlineOrderPickupExpiredEmail,
  sendOnlineOrderReadyEmail,
} from "@/lib/email/online-order-emails";
import { toPickupDateTime } from "@/lib/online-orders/pickup-schedule";
import {
  findActiveBusinessBySlug,
  findAssignedBusinessIdsByUserId,
  findSpotBusinessIdBySpotId,
} from "@/lib/repositories/businesses.repository";
import { decrementProductStockAdmin, findProductsByIds } from "@/lib/repositories/products.repository";
import { findReservationByIdForUser } from "@/lib/repositories/reservations.repository";
import {
  createOnlineOrder,
  createOnlineOrderItems,
  findExpiredPickupOrders,
  findOnlineOrderById,
  findOnlineOrderByIdForAdmin,
  findOnlineOrderByStripeSessionId,
  findOnlineOrderItemsByOrderId,
  findOnlineOrdersByBusiness,
  findOrdersByLinkedReservationIdAdmin,
  findOrdersByPickupDate,
  updateOnlineOrderPaymentStatus,
  updateOnlineOrderStatus,
  updateOnlineOrderStripePaymentIntent,
  updateOnlineOrderStripeSession,
  type OnlineOrderFilters,
} from "@/lib/repositories/online-order.repository";
import { recordPaymentLedgerAdmin } from "@/lib/repositories/payment-ledger.repository";
import { findAssignedBusinessIdsByStaffUserId } from "@/lib/repositories/staff-members.repository";
import { getStripe } from "@/lib/stripe/server";
import type { OnlineOrderItemRow, OnlineOrderRow, Profile } from "@/types/database";
import type { OnlineOrderFulfillmentType, OnlineOrderStatus } from "@/types/domain";
import type { CreateOrderInput } from "@/types/online-order";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

type OrderManagementProfile = Pick<Profile, "id" | "role">;

async function assertCanManageOrderBusiness(
  profile: OrderManagementProfile,
  businessId: string,
): Promise<ServiceResult<null>> {
  let assignedIds: readonly string[] = [];
  if (!isAdminRole(profile.role)) {
    assignedIds = isStaffRole(profile.role)
      ? await findAssignedBusinessIdsByStaffUserId(profile.id)
      : await findAssignedBusinessIdsByUserId(profile.id);
  }
  if (!canManageBusinessForProfile(profile, businessId, assignedIds)) {
    return { ok: false, error: "この事業への操作権限がありません。", status: 403 };
  }
  return { ok: true, data: null };
}

const SHIPPING_STATUS_FLOW: OnlineOrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "delivered",
];
const PICKUP_STATUS_FLOW: OnlineOrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
  "ready",
  "delivered",
];

/** 受け取り方法ごとの正規のステータス遷移で、次のステータスを1段階だけ返す */
export function getNextOnlineOrderStatus(
  current: OnlineOrderStatus,
  fulfillmentType: OnlineOrderFulfillmentType,
): OnlineOrderStatus | null {
  const flow = fulfillmentType === "shipping" ? SHIPPING_STATUS_FLOW : PICKUP_STATUS_FLOW;
  const idx = flow.indexOf(current);
  if (idx === -1 || idx === flow.length - 1) return null;
  return flow[idx + 1] ?? null;
}

/** Stripe Webhook・現地受け取り確認の両方で使う在庫減算処理（警告のみでブロックしない） */
async function decrementStockForOrderItems(items: OnlineOrderItemRow[]): Promise<void> {
  for (const item of items) {
    try {
      await decrementProductStockAdmin(item.product_id, item.quantity);
    } catch (e) {
      console.error("[online-order] stock decrement failed:", e);
    }
  }
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * 予約後の追加購入（Phase 19E）のリンク検証。ログイン中の本人の予約かつ
 * 同一事業であることを確認できた場合のみリンクを成立させる。検証に失敗しても
 * 注文作成自体は妨げない（リンクなしの通常注文として処理する）。
 */
async function resolveValidatedLinkedReservationId(
  linkedReservationId: string | undefined,
  businessId: string,
): Promise<string | null> {
  if (!linkedReservationId) return null;

  try {
    const user = await getUser();
    if (!user) return null;

    const reservation = await findReservationByIdForUser(linkedReservationId, user.id);
    if (!reservation) return null;

    const spotBusinessId = await findSpotBusinessIdBySpotId(reservation.spot_id);
    if (spotBusinessId !== businessId) return null;

    return reservation.id;
  } catch (e) {
    console.error("[createOrder] linkedReservationId validation failed:", e);
    return null;
  }
}

/**
 * 注文作成（在庫チェック・配送可否チェックを含む）。
 * 支払い方法にかかわらず注文レコードは作成する（Stripe決済の場合は
 * status='pending_payment' のまま保持し、後続で Checkout Session を作成する）。
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<ServiceResult<{ order: OnlineOrderRow; items: OnlineOrderItemRow[] }>> {
  if (input.items.length === 0) {
    return { ok: false, error: "カートが空です。", status: 400 };
  }

  const business = await findActiveBusinessBySlug(input.slug);
  if (!business || business.id !== input.businessId) {
    return { ok: false, error: "店舗情報が見つかりません。", status: 404 };
  }

  const productIds = input.items.map((i) => i.productId);
  const products = await findProductsByIds(productIds, input.businessId);
  const productById = new Map(products.map((p) => [p.id, p]));

  for (const item of input.items) {
    const product = productById.get(item.productId);
    if (!product) {
      return { ok: false, error: "購入できない商品が含まれています。", status: 400 };
    }
    if (
      product.track_inventory &&
      product.stock_quantity !== null &&
      product.stock_quantity < item.quantity
    ) {
      return {
        ok: false,
        error: `「${product.name}」の在庫が不足しています。現在の在庫数: ${product.stock_quantity}`,
        status: 400,
      };
    }
    if (input.fulfillmentType === "shipping" && !product.shippable) {
      return {
        ok: false,
        error: `「${product.name}」は配送できません。店舗受け取りをお選びください。`,
        status: 400,
      };
    }
  }

  if (input.fulfillmentType === "shipping" && !input.shippingAddress) {
    return { ok: false, error: "配送先住所を入力してください。", status: 400 };
  }
  if (input.fulfillmentType === "pickup" && (!input.pickupDate || !input.pickupTime)) {
    return { ok: false, error: "受け取り希望日時を選択してください。", status: 400 };
  }

  let subtotalAmount = 0;
  let taxAmount = 0;
  const itemInputs: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    taxRate: number;
    quantity: number;
  }> = [];

  for (const item of input.items) {
    const product = productById.get(item.productId)!;
    const net = product.price_excluding_tax * item.quantity;
    const tax = Math.floor((net * product.default_tax_rate) / 100);
    subtotalAmount += net;
    taxAmount += tax;
    itemInputs.push({
      productId: product.id,
      productName: product.name,
      unitPrice: product.price_excluding_tax,
      taxRate: product.default_tax_rate,
      quantity: item.quantity,
    });
  }

  const totalAmount = subtotalAmount + taxAmount;

  const pickupDateIso =
    input.fulfillmentType === "pickup" && input.pickupDate && input.pickupTime
      ? toPickupDateTime(input.pickupDate, input.pickupTime).toISOString()
      : null;

  // 決済方法は受け取り方法から一意に決まるため、クライアントからは受け取らない
  // （配送=Stripe決済のみ、店舗受け取り=現地決済のみ）。
  const paymentMethod = input.fulfillmentType === "shipping" ? "stripe" : "in_person";

  const linkedReservationId = await resolveValidatedLinkedReservationId(
    input.linkedReservationId,
    input.businessId,
  );

  let order: OnlineOrderRow;
  try {
    order = await createOnlineOrder({
      business_id: input.businessId,
      fulfillment_type: input.fulfillmentType,
      payment_method: paymentMethod,
      subtotal_amount: subtotalAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone ?? null,
      shipping_postal_code: input.shippingAddress?.postalCode ?? null,
      shipping_prefecture: input.shippingAddress?.prefecture ?? null,
      shipping_address_line1: input.shippingAddress?.addressLine1 ?? null,
      shipping_address_line2: input.shippingAddress?.addressLine2 ?? null,
      pickup_date: pickupDateIso,
      linked_reservation_id: linkedReservationId,
    });
  } catch (e) {
    console.error("[createOrder] order insert failed:", e);
    return { ok: false, error: "注文の作成に失敗しました。", status: 500 };
  }

  let items: OnlineOrderItemRow[];
  try {
    items = await createOnlineOrderItems(
      itemInputs.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.productName,
        unit_price: i.unitPrice,
        tax_rate: i.taxRate,
        quantity: i.quantity,
      })),
    );
  } catch (e) {
    console.error("[createOrder] order items insert failed:", e);
    return { ok: false, error: "注文明細の作成に失敗しました。", status: 500 };
  }

  await sendOnlineOrderConfirmationEmail({
    orderId: order.id,
    customerEmail: order.customer_email,
    fulfillmentType: order.fulfillment_type,
    items: items.map((i) => ({ productName: i.product_name, quantity: i.quantity, unitPrice: i.unit_price })),
    totalAmount: order.total_amount,
    confirmationCode: order.confirmation_code,
    pickupDate: order.pickup_date,
    pickupDeadline: order.pickup_deadline,
  });

  return { ok: true, data: { order, items } };
}

/** 注文完了ページ表示用。ゲスト顧客のため service_role で取得する */
export async function getOrderForCustomer(
  orderId: string,
  businessId: string,
): Promise<{ order: OnlineOrderRow; items: OnlineOrderItemRow[] } | null> {
  const order = await findOnlineOrderById(orderId, businessId);
  if (!order) return null;
  const items = await findOnlineOrderItemsByOrderId(orderId);
  return { order, items };
}

/** Stripe Checkout Session 作成（決済方法が stripe の注文のみ） */
export async function createStripeCheckoutSessionForOrder(
  orderId: string,
  businessId: string,
  slug: string,
): Promise<ServiceResult<{ checkoutUrl: string }>> {
  const order = await findOnlineOrderById(orderId, businessId);
  if (!order) {
    return { ok: false, error: "注文が見つかりません。", status: 404 };
  }
  if (order.payment_method !== "stripe") {
    return { ok: false, error: "オンライン決済の注文ではありません。", status: 422 };
  }
  if (order.status !== "pending_payment") {
    return { ok: false, error: "この注文はすでに処理されています。", status: 422 };
  }

  const items = await findOnlineOrderItemsByOrderId(orderId);
  const itemSummary = items.map((i) => `${i.product_name} x${i.quantity}`).join(", ");

  const stripe = getStripe();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: `ご注文（${items.length}点）`,
              description: itemSummary.slice(0, 500),
            },
            unit_amount: order.total_amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        orderId: order.id,
        businessId: order.business_id,
        ...(order.linked_reservation_id ? { linkedReservationId: order.linked_reservation_id } : {}),
      },
      success_url: `${appUrl()}/shop/${slug}/order-complete?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/shop/${slug}/checkout`,
    });
  } catch (e) {
    console.error("[createStripeCheckoutSessionForOrder] Stripe session create failed:", e);
    return { ok: false, error: "決済ページの作成に失敗しました。", status: 500 };
  }

  if (!session.url) {
    return { ok: false, error: "決済ページの作成に失敗しました。", status: 500 };
  }

  await updateOnlineOrderStripeSession(order.id, session.id);

  return { ok: true, data: { checkoutUrl: session.url } };
}

/**
 * Stripe Webhook（checkout.session.completed）処理。
 * 在庫減算・payment_ledger 記録・ステータス更新を行う。
 * 冪等性: order.payment_status === 'paid' なら何もしない。
 */
export async function handleOnlineOrderCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  const order = session.metadata?.businessId
    ? await findOnlineOrderById(orderId, session.metadata.businessId)
    : await findOnlineOrderByStripeSessionId(session.id);

  if (!order) {
    console.warn("[online-order webhook] order not found", { orderId });
    return;
  }

  if (order.payment_status === "paid") {
    return;
  }

  const items = await findOnlineOrderItemsByOrderId(order.id);
  await decrementStockForOrderItems(items);

  await updateOnlineOrderPaymentStatus(order.id, "paid");
  await updateOnlineOrderStatus(order.id, "preparing");

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  if (paymentIntentId) {
    try {
      await updateOnlineOrderStripePaymentIntent(order.id, paymentIntentId);
    } catch (e) {
      console.error("[online-order webhook] payment_intent record failed:", e);
    }
  }

  try {
    await recordPaymentLedgerAdmin({
      business_id: order.business_id,
      source_type: "online_order",
      source_id: order.id,
      amount: session.amount_total ?? order.total_amount,
      payment_method: "card",
      status: "succeeded",
      paid_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[online-order webhook] payment_ledger record failed:", e);
  }
}

/**
 * 予約に紐づく追加購入注文の一覧（Phase 19E）。呼び出し元（予約詳細ページ）で
 * 予約への閲覧権限を確認済みであることを前提とする。
 */
export async function getLinkedOrdersForReservation(
  reservationId: string,
): Promise<OnlineOrderRow[]> {
  try {
    return await findOrdersByLinkedReservationIdAdmin(reservationId);
  } catch (e) {
    console.error("[getLinkedOrdersForReservation]", e);
    return [];
  }
}

/** 管理画面の注文一覧用。事業への操作権限がない場合はエラーを返す */
export async function getOnlineOrdersForBusiness(
  profile: OrderManagementProfile,
  businessId: string,
  filters: OnlineOrderFilters = {},
): Promise<ServiceResult<OnlineOrderRow[]>> {
  const auth = await assertCanManageOrderBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const orders = await findOnlineOrdersByBusiness(businessId, filters);
    return { ok: true, data: orders };
  } catch {
    return { ok: false, error: "注文一覧の取得に失敗しました。", status: 500 };
  }
}

/** 管理画面の注文詳細用。RLS で閲覧範囲外の注文は null になる */
export async function getOnlineOrderDetailForAdmin(
  orderId: string,
): Promise<{ order: OnlineOrderRow; items: OnlineOrderItemRow[] } | null> {
  const order = await findOnlineOrderByIdForAdmin(orderId);
  if (!order) return null;
  const items = await findOnlineOrderItemsByOrderId(orderId);
  return { order, items };
}

/**
 * 注文ステータスを正規の遷移で1段階進める（配送・店舗受け取りで別フロー）。
 * business_admin のみ操作可（staff は閲覧のみ）。
 */
export async function advanceOnlineOrderStatus(
  profile: OrderManagementProfile,
  orderId: string,
): Promise<ServiceResult<{ status: OnlineOrderStatus }>> {
  if (!hasPermission(profile.role, "ORDER_STATUS_MANAGE")) {
    return { ok: false, error: "ステータスを変更する権限がありません。", status: 403 };
  }

  const order = await findOnlineOrderByIdForAdmin(orderId);
  if (!order) {
    return { ok: false, error: "注文が見つかりません。", status: 404 };
  }

  const auth = await assertCanManageOrderBusiness(profile, order.business_id);
  if (!auth.ok) return auth;

  const next = getNextOnlineOrderStatus(order.status, order.fulfillment_type);
  if (!next) {
    return { ok: false, error: "これ以上ステータスを進めることはできません。", status: 422 };
  }

  await updateOnlineOrderStatus(orderId, next);

  if (next === "ready") {
    await sendOnlineOrderReadyEmail({
      orderId: order.id,
      customerEmail: order.customer_email,
      confirmationCode: order.confirmation_code,
      pickupDeadline: order.pickup_deadline,
    });
  }

  return { ok: true, data: { status: next } };
}

/**
 * 現地決済注文の受け取り確認。在庫減算・支払いステータス更新・売上記録を行い
 * ステータスを delivered にする。business_admin のみ操作可。
 * 冪等性: payment_status === 'paid' ならエラーを返す（二重の在庫減算を防ぐ）。
 */
const PICKUP_PAYMENT_METHODS = ["cash", "card", "qr"] as const;
export type PickupPaymentMethod = (typeof PICKUP_PAYMENT_METHODS)[number];

export function isPickupPaymentMethod(value: string): value is PickupPaymentMethod {
  return (PICKUP_PAYMENT_METHODS as readonly string[]).includes(value);
}

export async function confirmInPersonOrderPickup(
  profile: OrderManagementProfile,
  orderId: string,
  confirmationCode: string,
  paymentMethod: PickupPaymentMethod,
): Promise<ServiceResult<null>> {
  if (!hasPermission(profile.role, "ORDER_STATUS_MANAGE")) {
    return { ok: false, error: "この操作を行う権限がありません。", status: 403 };
  }

  const order = await findOnlineOrderByIdForAdmin(orderId);
  if (!order) {
    return { ok: false, error: "注文が見つかりません。", status: 404 };
  }

  const auth = await assertCanManageOrderBusiness(profile, order.business_id);
  if (!auth.ok) return auth;

  if (order.payment_method !== "in_person") {
    return { ok: false, error: "現地決済の注文ではありません。", status: 422 };
  }
  if (order.payment_status === "paid") {
    return { ok: false, error: "この注文はすでに受け取り確認済みです。", status: 422 };
  }
  if (!order.confirmation_code) {
    return { ok: false, error: "確認コードが設定されていません。管理者にお問い合わせください。", status: 422 };
  }
  if (confirmationCode.trim() !== order.confirmation_code) {
    return { ok: false, error: "確認コードが一致しません。", status: 422 };
  }

  const items = await findOnlineOrderItemsByOrderId(orderId);
  await decrementStockForOrderItems(items);

  await updateOnlineOrderPaymentStatus(orderId, "paid");
  await updateOnlineOrderStatus(orderId, "delivered");

  try {
    await recordPaymentLedgerAdmin({
      business_id: order.business_id,
      source_type: "online_order",
      source_id: order.id,
      amount: order.total_amount,
      payment_method: paymentMethod,
      status: "succeeded",
      paid_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[confirmInPersonOrderPickup] payment_ledger record failed:", e);
  }

  return { ok: true, data: null };
}

/** 管理画面「本日の受け取り予定」タブ用。当日 JST の pickup_date 注文（明細付き）を返す */
export async function getTodaysPickupOrders(
  profile: OrderManagementProfile,
  businessId: string,
): Promise<ServiceResult<Array<{ order: OnlineOrderRow; items: OnlineOrderItemRow[] }>>> {
  const auth = await assertCanManageOrderBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const orders = await findOrdersByPickupDate(businessId, new Date());
    const withItems = await Promise.all(
      orders.map(async (order) => ({
        order,
        items: await findOnlineOrderItemsByOrderId(order.id),
      })),
    );
    return { ok: true, data: withItems };
  } catch {
    return { ok: false, error: "本日の受け取り予定の取得に失敗しました。", status: 500 };
  }
}

/**
 * 受け取り期限切れの店舗受け取り注文を自動キャンセルする（cron 用）。
 * 冪等性: 対象は status in (paid, preparing, ready) のみのため、
 * キャンセル後は再実行しても対象から外れる。
 */
export async function expirePickupOrders(): Promise<number> {
  const expiredOrders = await findExpiredPickupOrders();

  let cancelledCount = 0;
  for (const order of expiredOrders) {
    try {
      await updateOnlineOrderStatus(order.id, "cancelled");
      cancelledCount += 1;
    } catch (e) {
      console.error("[expirePickupOrders] failed to cancel order:", order.id, e);
      continue;
    }

    await sendOnlineOrderPickupExpiredEmail({
      orderId: order.id,
      customerEmail: order.customer_email,
      pickupDate: order.pickup_date,
    });
  }

  return cancelledCount;
}

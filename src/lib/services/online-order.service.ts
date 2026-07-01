import Stripe from "stripe";
import { findActiveBusinessBySlug } from "@/lib/repositories/businesses.repository";
import { decrementProductStockAdmin, findProductsByIds } from "@/lib/repositories/products.repository";
import {
  createOnlineOrder,
  createOnlineOrderItems,
  findOnlineOrderById,
  findOnlineOrderByStripeSessionId,
  findOnlineOrderItemsByOrderId,
  updateOnlineOrderPaymentStatus,
  updateOnlineOrderStatus,
  updateOnlineOrderStripeSession,
} from "@/lib/repositories/online-order.repository";
import { recordPaymentLedgerAdmin } from "@/lib/repositories/payment-ledger.repository";
import { getStripe } from "@/lib/stripe/server";
import type { OnlineOrderItemRow, OnlineOrderRow } from "@/types/database";
import type { CreateOrderInput } from "@/types/online-order";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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

  let order: OnlineOrderRow;
  try {
    order = await createOnlineOrder({
      business_id: input.businessId,
      fulfillment_type: input.fulfillmentType,
      payment_method: input.paymentMethod,
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
    });
  } catch {
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
  } catch {
    return { ok: false, error: "注文明細の作成に失敗しました。", status: 500 };
  }

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
  const session = await stripe.checkout.sessions.create({
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
    },
    success_url: `${appUrl()}/shop/${slug}/order-complete?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/shop/${slug}/checkout`,
  });

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

  for (const item of items) {
    try {
      await decrementProductStockAdmin(item.product_id, item.quantity);
    } catch (e) {
      console.error("[online-order webhook] stock decrement failed:", e);
    }
  }

  await updateOnlineOrderPaymentStatus(order.id, "paid");
  await updateOnlineOrderStatus(order.id, "preparing");

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

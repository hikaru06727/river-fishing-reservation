"use server";

import { findActiveBusinessBySlug } from "@/lib/repositories/businesses.repository";
import { createOrder, createStripeCheckoutSessionForOrder } from "@/lib/services/online-order.service";
import { createOnlineOrderSchema } from "@/validations/online-order";

export type SubmitOrderResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string };

export async function submitOrderAction(input: unknown): Promise<SubmitOrderResult> {
  const parsed = createOnlineOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容が正しくありません。" };
  }

  const data = parsed.data;

  const business = await findActiveBusinessBySlug(data.slug);
  if (!business || business.id !== data.businessId) {
    return { ok: false, error: "店舗情報が見つかりません。" };
  }

  const result = await createOrder({
    businessId: data.businessId,
    slug: data.slug,
    items: data.items,
    fulfillmentType: data.fulfillmentType,
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone,
    shippingAddress: data.shippingAddress,
    pickupDate: data.pickupDate,
    pickupTime: data.pickupTime,
    linkedReservationId: data.linkedReservationId,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const { order } = result.data;

  if (data.fulfillmentType === "pickup") {
    return {
      ok: true,
      redirectUrl: `/shop/${data.slug}/order-complete?order_id=${order.id}`,
    };
  }

  const sessionResult = await createStripeCheckoutSessionForOrder(
    order.id,
    data.businessId,
    data.slug,
  );

  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error };
  }

  return { ok: true, redirectUrl: sessionResult.data.checkoutUrl };
}

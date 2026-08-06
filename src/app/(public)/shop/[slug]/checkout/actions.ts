"use server";

import { getUser } from "@/lib/auth/get-user";
import { findActiveBusinessBySlug } from "@/lib/repositories/businesses.repository";
import { createOrder, createStripeCheckoutSessionForOrder } from "@/lib/services/online-order.service";
import { updateProfileAddress } from "@/lib/services/profile.service";
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

  const user = await getUser();

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
    userId: user?.id,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (user && data.saveAddress) {
    try {
      await updateProfileAddress(user.id, {
        fullName: data.customerName,
        phone: data.customerPhone ?? undefined,
        // 店舗受け取り（住所欄なし）の場合は住所系を undefined のままにし、
        // 過去に保存済みの配送先住所を誤って消さない。
        ...(data.fulfillmentType === "shipping" && data.shippingAddress
          ? {
              postalCode: data.shippingAddress.postalCode,
              prefecture: data.shippingAddress.prefecture,
              addressLine1: data.shippingAddress.addressLine1,
              addressLine2: data.shippingAddress.addressLine2 ?? null,
            }
          : {}),
      });
    } catch (e) {
      // 住所保存の失敗は注文自体を失敗させない（Phase 20: あくまで利便性機能のため）
      console.error("[submitOrderAction] profile address save failed:", e);
    }
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

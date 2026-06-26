"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { refundCash, refundCard } from "@/lib/services/refund.service";
import type { RefundActionState } from "./action-state";

const baseSchema = z.object({
  businessId: z.string().uuid("事業IDが不正です。"),
  amount: z.coerce.number().positive("返金額は0より大きい値を入力してください。"),
  reason: z.string().min(1, "返金理由を入力してください。").max(500),
  saleSessionId: z.string().uuid().optional().nullable(),
  reservationId: z.string().uuid().optional().nullable(),
});

export async function refundCashAction(
  _prev: RefundActionState,
  formData: FormData,
): Promise<RefundActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/refunds");

  const parsed = baseSchema.safeParse({
    businessId: formData.get("businessId"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
    saleSessionId: formData.get("saleSessionId") || null,
    reservationId: formData.get("reservationId") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  }

  const { businessId, amount, reason, saleSessionId, reservationId } = parsed.data;

  if (!saleSessionId && !reservationId) {
    return { error: "対象の売上IDが指定されていません。" };
  }

  const result = await refundCash(session.profile, {
    businessId,
    saleSessionId: saleSessionId ?? undefined,
    reservationId: reservationId ?? undefined,
    amount,
    reason,
    refundedBy: session.profile.id,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  return { success: `¥${amount.toLocaleString()} の現金返金を記録しました。` };
}

export async function refundCardAction(
  _prev: RefundActionState,
  formData: FormData,
): Promise<RefundActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/refunds");

  const schema = baseSchema.extend({
    stripePaymentIntentId: z.string().optional().nullable(),
  });

  const parsed = schema.safeParse({
    businessId: formData.get("businessId"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
    saleSessionId: formData.get("saleSessionId") || null,
    reservationId: formData.get("reservationId") || null,
    stripePaymentIntentId: formData.get("stripePaymentIntentId") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  }

  const { businessId, amount, reason, saleSessionId, reservationId, stripePaymentIntentId } =
    parsed.data;

  if (!saleSessionId && !reservationId) {
    return { error: "対象の売上IDが指定されていません。" };
  }

  const result = await refundCard(session.profile, {
    businessId,
    saleSessionId: saleSessionId ?? undefined,
    reservationId: reservationId ?? undefined,
    stripePaymentIntentId: stripePaymentIntentId ?? undefined,
    amount,
    reason,
    refundedBy: session.profile.id,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  return { success: `¥${amount.toLocaleString()} のカード返金を記録しました。` };
}

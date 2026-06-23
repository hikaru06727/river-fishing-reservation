"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { createSaleSession } from "@/lib/services/sale-session.service";
import { parsePosForm } from "@/validations/pos";
import type { PosActionState } from "./action-state";

export async function createSaleSessionAction(
  _prev: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/pos");

  const parsed = parsePosForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  }

  const { businessId, items, sessionDiscount, paymentMethod, paymentOtherLabel, note } = parsed.data;

  let result: Awaited<ReturnType<typeof createSaleSession>>;
  try {
    result = await createSaleSession(session.profile, {
      business_id: businessId,
      payment_method: paymentMethod,
      payment_other_label: paymentOtherLabel ?? null,
      items: items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        tax_rate: i.tax_rate,
        item_discount: i.item_discount ?? null,
      })),
      session_discount: sessionDiscount ?? null,
      note: note ?? null,
    });
  } catch (e) {
    console.error("POS ERROR:", e);
    return { error: "予期しないエラーが発生しました。" };
  }

  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin/products/sales?businessId=" + businessId);
}

"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import {
  createManualSale,
  deleteManualSaleById,
  updateManualSaleById,
} from "@/lib/services/manual-sales.service";
import { parseManualSaleForm } from "@/validations/manual-sale";
import type { ManualSaleActionState } from "./action-state";

export async function createManualSaleAction(
  _prev: ManualSaleActionState,
  formData: FormData,
): Promise<ManualSaleActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/manual-sales/new");

  const parsed = parseManualSaleForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  }

  const { businessId, locationId, saleDate, amountYen, taxRatePercent, category, paymentMethod, description } = parsed.data;

  const result = await createManualSale(session.profile, {
    business_id: businessId,
    location_id: locationId ?? null,
    sale_date: saleDate,
    amount_yen: amountYen,
    tax_rate_percent: taxRatePercent,
    category,
    payment_method: paymentMethod,
    description: description ?? null,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin/manual-sales?businessId=" + businessId);
}

export async function updateManualSaleAction(
  _prev: ManualSaleActionState,
  formData: FormData,
): Promise<ManualSaleActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/manual-sales");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "IDが不正です。" };
  }

  const parsed = parseManualSaleForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  }

  const { businessId, locationId, saleDate, amountYen, taxRatePercent, category, paymentMethod, description } = parsed.data;

  const result = await updateManualSaleById(session.profile, id, {
    location_id: locationId ?? null,
    sale_date: saleDate,
    amount_yen: amountYen,
    tax_rate_percent: taxRatePercent,
    category,
    payment_method: paymentMethod,
    description: description ?? null,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin/manual-sales?businessId=" + businessId);
}

export async function deleteManualSaleAction(formData: FormData): Promise<void> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/manual-sales");

  const id = formData.get("id");
  const businessId = formData.get("businessId");

  if (typeof id !== "string" || !id) {
    return;
  }

  const result = await deleteManualSaleById(session.profile, id);
  if (!result.ok) {
    throw new Error(result.error);
  }

  redirect(
    "/admin/manual-sales" +
      (typeof businessId === "string" && businessId ? "?businessId=" + businessId : ""),
  );
}

"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import {
  closeRegister,
  requestCorrection,
  approveCorrection,
} from "@/lib/services/register-closing.service";
import type { RegisterClosingActionState } from "./action-state";

export async function closeRegisterAction(
  _prev: RegisterClosingActionState,
  formData: FormData,
): Promise<RegisterClosingActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/register-closing");

  const businessId = formData.get("businessId");
  const locationId = formData.get("locationId") as string | null;
  const periodStartStr = formData.get("periodStart");
  const periodEndStr = formData.get("periodEnd");
  const note = formData.get("note") as string | null;

  if (typeof businessId !== "string" || !businessId) {
    return { error: "事業IDが不正です。" };
  }
  if (typeof periodStartStr !== "string" || typeof periodEndStr !== "string") {
    return { error: "締め期間の指定が不正です。" };
  }

  const periodStart = new Date(periodStartStr);
  const periodEnd = new Date(periodEndStr);

  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
    return { error: "締め期間の日時が不正です。" };
  }
  if (periodStart >= periodEnd) {
    return { error: "期間の開始が終了以降になっています。" };
  }

  const result = await closeRegister(session.profile, {
    businessId,
    locationId: locationId || null,
    periodStart,
    periodEnd,
    note: note || null,
    closedBy: session.profile.id,
  });

  if (!result.ok) {
    return {
      error: result.error,
      ...(result.unsettledBlock ? { unsettledBlock: result.unsettledBlock } : {}),
    };
  }

  redirect("/admin/register-closing?businessId=" + businessId);
}

export async function requestCorrectionAction(
  _prev: RegisterClosingActionState,
  formData: FormData,
): Promise<RegisterClosingActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/register-closing");

  const closingId = formData.get("closingId");
  const businessId = formData.get("businessId");
  const reason = formData.get("reason");

  if (typeof closingId !== "string" || !closingId) {
    return { error: "締め記録IDが不正です。" };
  }
  if (typeof businessId !== "string" || !businessId) {
    return { error: "事業IDが不正です。" };
  }
  if (typeof reason !== "string" || !reason.trim()) {
    return { error: "修正理由を入力してください。" };
  }

  const result = await requestCorrection(session.profile, {
    closingId,
    requestedBy: session.profile.id,
    reason: reason.trim(),
    businessId,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  return { success: "修正リクエストを送信しました。" };
}

export async function approveCorrectionAction(
  _prev: RegisterClosingActionState,
  formData: FormData,
): Promise<RegisterClosingActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/register-closing");

  const correctionId = formData.get("correctionId");
  const businessId = formData.get("businessId");

  if (typeof correctionId !== "string" || !correctionId) {
    return { error: "修正リクエストIDが不正です。" };
  }
  if (typeof businessId !== "string" || !businessId) {
    return { error: "事業IDが不正です。" };
  }

  const result = await approveCorrection(session.profile, {
    correctionId,
    approvedBy: session.profile.id,
    businessId,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  return { success: "修正リクエストを承認しました。" };
}

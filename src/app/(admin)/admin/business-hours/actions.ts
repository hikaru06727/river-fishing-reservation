"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import {
  createDateExceptionForSpot,
  deleteDateExceptionForSpot,
  saveWeeklyHoursForSpot,
  updateDateExceptionForSpot,
} from "@/lib/services/business-hours.service";
import {
  saveExceptionBreaksForSpot,
  saveWeeklyBreaksForSpot,
} from "@/lib/services/business-breaks.service";
import {
  parseDateExceptionForm,
  parseDeleteDateExceptionForm,
  parseWeeklyHoursForm,
} from "@/validations/business-hours";
import {
  parseExceptionBreaksForm,
  parseWeeklyBreaksForm,
} from "@/validations/business-breaks";
import type { AdminBusinessHoursActionState } from "./action-state";

export async function saveWeeklyHoursAction(
  _prevState: AdminBusinessHoursActionState,
  formData: FormData,
): Promise<AdminBusinessHoursActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/business-hours");
  }

  const parsed = parseWeeklyHoursForm(formData);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message;
    return { error: firstError ?? "入力内容を確認してください。" };
  }

  const result = await saveWeeklyHoursForSpot(session.profile, parsed.data);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/business-hours");
  return { success: "曜日別営業時間を保存しました。" };
}

export async function saveWeeklyBreaksAction(
  _prevState: AdminBusinessHoursActionState,
  formData: FormData,
): Promise<AdminBusinessHoursActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/business-hours");
  }

  const parsed = parseWeeklyBreaksForm(formData);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message;
    return { error: firstError ?? "入力内容を確認してください。" };
  }

  const result = await saveWeeklyBreaksForSpot(session.profile, parsed.data);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/business-hours");
  return { success: "曜日別休み時間を保存しました。" };
}

export async function saveExceptionBreaksAction(
  _prevState: AdminBusinessHoursActionState,
  formData: FormData,
): Promise<AdminBusinessHoursActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/business-hours");
  }

  const parsed = parseExceptionBreaksForm(formData);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message;
    return { error: firstError ?? "入力内容を確認してください。" };
  }

  const result = await saveExceptionBreaksForSpot(session.profile, parsed.data);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/business-hours");
  return { success: "例外日の休み時間を保存しました。" };
}

export async function saveDateExceptionAction(
  _prevState: AdminBusinessHoursActionState,
  formData: FormData,
): Promise<AdminBusinessHoursActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/business-hours");
  }

  const parsed = parseDateExceptionForm(formData);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message;
    return { error: firstError ?? "入力内容を確認してください。" };
  }

  const result = parsed.data.exceptionId
    ? await updateDateExceptionForSpot(session.profile, parsed.data.exceptionId, parsed.data)
    : await createDateExceptionForSpot(session.profile, parsed.data);

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/business-hours");
  return { success: parsed.data.exceptionId ? "例外日を更新しました。" : "例外日を追加しました。" };
}

export async function deleteDateExceptionAction(
  _prevState: AdminBusinessHoursActionState,
  formData: FormData,
): Promise<AdminBusinessHoursActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/business-hours");
  }

  const parsed = parseDeleteDateExceptionForm(formData);
  if (!parsed.success) {
    return { error: "入力内容を確認してください。" };
  }

  const result = await deleteDateExceptionForSpot(
    session.profile,
    parsed.data.fishingSpotId,
    parsed.data.exceptionId,
  );

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/business-hours");
  return { success: "例外日を削除しました。" };
}

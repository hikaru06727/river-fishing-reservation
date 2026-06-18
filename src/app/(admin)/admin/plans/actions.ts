"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import {
  createAdminPlan,
  toggleAdminPlanAcceptingReservations,
  toggleAdminPlanVisibility,
  updateAdminPlan,
} from "@/lib/services/plans.service";
import { parseAdminPlanForm } from "@/validations/plan";

export type AdminPlanActionState = {
  error?: string;
};

export const adminPlanActionInitialState: AdminPlanActionState = {};

function sanitizeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/admin/plans")) {
    return "/admin/plans";
  }
  return value;
}

function firstValidationError(
  formData: FormData,
  options?: { allowLegacyGlobal?: boolean },
): AdminPlanActionState | null {
  const parsed = parseAdminPlanForm(formData, options);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message;
    return { error: firstError ?? "入力内容を確認してください。" };
  }
  return null;
}

export async function createAdminPlanAction(
  _prevState: AdminPlanActionState,
  formData: FormData,
): Promise<AdminPlanActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/plans/new");
  }

  const validationError = firstValidationError(formData);
  if (validationError) {
    return validationError;
  }

  const parsed = parseAdminPlanForm(formData);
  if (!parsed.success) {
    return { error: "入力内容を確認してください。" };
  }

  const result = await createAdminPlan(session.profile, parsed.data);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin/plans");
}

export async function updateAdminPlanAction(
  _prevState: AdminPlanActionState,
  formData: FormData,
): Promise<AdminPlanActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/plans");
  }

  const planId = formData.get("planId");
  if (typeof planId !== "string" || !planId) {
    return { error: "プランIDが不正です。" };
  }

  const allowLegacyGlobal = formData.get("legacyGlobalPlan") === "true";
  const validationError = firstValidationError(formData, { allowLegacyGlobal });
  if (validationError) {
    return validationError;
  }

  const parsed = parseAdminPlanForm(formData, { allowLegacyGlobal });
  if (!parsed.success) {
    return { error: "入力内容を確認してください。" };
  }

  const result = await updateAdminPlan(session.profile, planId, parsed.data);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect(sanitizeReturnTo(formData.get("returnTo")));
}

export async function togglePlanVisibilityAction(
  _prevState: AdminPlanActionState,
  formData: FormData,
): Promise<AdminPlanActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/plans");
  }

  const planId = formData.get("planId");
  const isVisible = formData.get("isVisible") === "true";

  if (typeof planId !== "string" || !planId) {
    return { error: "プランIDが不正です。" };
  }

  const result = await toggleAdminPlanVisibility(session.profile, planId, isVisible);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/plans");
  redirect(sanitizeReturnTo(formData.get("returnTo")));
}

export async function togglePlanAcceptingReservationsAction(
  _prevState: AdminPlanActionState,
  formData: FormData,
): Promise<AdminPlanActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/plans");
  }

  const planId = formData.get("planId");
  const isAcceptingReservations = formData.get("isAcceptingReservations") === "true";

  if (typeof planId !== "string" || !planId) {
    return { error: "プランIDが不正です。" };
  }

  const result = await toggleAdminPlanAcceptingReservations(
    session.profile,
    planId,
    isAcceptingReservations,
  );
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/plans");
  redirect(sanitizeReturnTo(formData.get("returnTo")));
}

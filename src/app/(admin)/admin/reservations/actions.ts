"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { canCurrentUserManageReservation } from "@/lib/auth/management-access";
import { cancelReservation } from "@/lib/services/reservations.service";
import { markCashPaymentReceived } from "@/lib/services/payments.service";
import { resolveAddonCleanupIssue } from "@/lib/services/reservation-addon-cleanup.service";
import type {
  AdminCancelReservationState,
  AdminMarkCashPaymentReceivedState,
  ResolveAddonCleanupIssueState,
} from "@/types/reservation-action";

function sanitizeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/admin")) {
    return "/admin/reservations";
  }
  return value;
}

export async function adminCancelReservationAction(
  _prevState: AdminCancelReservationState,
  formData: FormData,
): Promise<AdminCancelReservationState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/login?next=/admin/reservations");
  }

  const reservationId = formData.get("reservationId");
  if (typeof reservationId !== "string" || !reservationId) {
    return { error: "予約IDが不正です。" };
  }

  const canManage = await canCurrentUserManageReservation(reservationId);
  if (!canManage) {
    return { error: "この予約を操作する権限がありません。" };
  }

  const cancelledBy =
    session.profile.role === "business_admin" ? "business_admin" : "admin";

  const result = await cancelReservation(
    session.user.id,
    { reservationId },
    { isAdmin: true, cancelledBy },
  );

  if (!result.ok) {
    return { error: result.error };
  }

  redirect(sanitizeReturnTo(formData.get("returnTo")));
}

export async function adminMarkCashPaymentReceivedAction(
  _prevState: AdminMarkCashPaymentReceivedState,
  formData: FormData,
): Promise<AdminMarkCashPaymentReceivedState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/login?next=/admin/reservations");
  }

  const reservationId = formData.get("reservationId");
  if (typeof reservationId !== "string" || !reservationId) {
    return { error: "予約IDが不正です。" };
  }

  const canManage = await canCurrentUserManageReservation(reservationId);
  if (!canManage) {
    return { error: "この予約を操作する権限がありません。" };
  }

  const result = await markCashPaymentReceived(reservationId);

  if (!result.ok) {
    return { error: result.error };
  }

  redirect(sanitizeReturnTo(formData.get("returnTo")));
}

const resolveAddonCleanupIssueSchema = z.object({
  businessId: z.string().uuid("事業IDが不正です。"),
  issueId: z.string().uuid("記録IDが不正です。"),
  note: z.string().max(500).optional().nullable(),
});

export async function resolveAddonCleanupIssueAction(
  _prevState: ResolveAddonCleanupIssueState,
  formData: FormData,
): Promise<ResolveAddonCleanupIssueState> {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/login?next=/admin/reservations");
  }

  const parsed = resolveAddonCleanupIssueSchema.safeParse({
    businessId: formData.get("businessId"),
    issueId: formData.get("issueId"),
    note: (formData.get("note") as string | null) || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  }

  const { businessId, issueId, note } = parsed.data;

  const result = await resolveAddonCleanupIssue(session.profile, { businessId, issueId, note });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/reservations");

  return { success: "対応済みにしました。" };
}

"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { canCurrentUserManageReservation } from "@/lib/auth/management-access";
import { cancelReservation } from "@/lib/services/reservations.service";
import { markCashPaymentReceived } from "@/lib/services/payments.service";
import type {
  AdminCancelReservationState,
  AdminMarkCashPaymentReceivedState,
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
    redirect("/admin/login?next=/admin/reservations");
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
    redirect("/admin/login?next=/admin/reservations");
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

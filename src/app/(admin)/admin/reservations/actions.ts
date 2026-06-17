"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { canCurrentUserManageReservation } from "@/lib/auth/management-access";
import { cancelReservation } from "@/lib/services/reservations.service";
import type { AdminCancelReservationState } from "@/types/reservation-action";

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

  const result = await cancelReservation(
    session.user.id,
    { reservationId },
    { isAdmin: true },
  );

  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin/reservations");
}

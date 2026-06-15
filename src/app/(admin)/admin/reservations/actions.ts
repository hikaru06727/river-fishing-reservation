"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";
import { isAdminUser } from "@/lib/auth/role";
import { cancelReservation } from "@/lib/services/reservations.service";
import type { AdminCancelReservationState } from "@/types/reservation-action";

export async function adminCancelReservationAction(
  _prevState: AdminCancelReservationState,
  formData: FormData,
): Promise<AdminCancelReservationState> {
  const user = await getUser();
  if (!user || !isAdminUser(user)) {
    redirect("/login?next=/admin/reservations");
  }

  const result = await cancelReservation(
    user.id,
    { reservationId: formData.get("reservationId") },
    { isAdmin: true },
  );

  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin/reservations");
}

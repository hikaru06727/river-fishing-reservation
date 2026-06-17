"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";
import {
  cancelReservation,
  createReservation,
} from "@/lib/services/reservations.service";
import type {
  CancelReservationState,
  CreateReservationState,
} from "@/types/reservation-action";

export async function createReservationAction(
  _prevState: CreateReservationState,
  formData: FormData,
): Promise<CreateReservationState> {
  const user = await getUser();
  if (!user) {
    redirect("/login?next=/my/reservations");
  }

  const result = await createReservation(user.id, {
    spotId: formData.get("spotId"),
    planId: formData.get("planId"),
    slotId: formData.get("slotId"),
    reservationDate: formData.get("reservationDate"),
    guestCount: formData.get("guestCount"),
    paymentMethod: formData.get("paymentMethod"),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  redirect(result.data.redirectPath);
}

export async function cancelReservationAction(
  _prevState: CancelReservationState,
  formData: FormData,
): Promise<CancelReservationState> {
  const user = await getUser();
  if (!user) {
    redirect("/login?next=/my/reservations");
  }

  const result = await cancelReservation(user.id, {
    reservationId: formData.get("reservationId"),
  });

  if (!result.ok) {
    return { error: result.error, success: false };
  }

  redirect("/my/reservations");
}

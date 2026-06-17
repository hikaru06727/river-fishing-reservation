import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentMethod, PaymentStatus, ReservationStatus } from "@/types/database";

export type ReservationPaymentAdminMeta = {
  payment_method: PaymentMethod;
  reservation_status: ReservationStatus;
  payment: {
    status: PaymentStatus;
  } | null;
};

export async function findReservationPaymentMetaByIdAdmin(
  reservationId: string,
): Promise<ReservationPaymentAdminMeta | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservations")
    .select("payment_method, status, payments ( status )")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const payments = data.payments as unknown as Array<{ status: PaymentStatus }> | null;
  const payment = payments?.[0] ?? null;

  return {
    payment_method: data.payment_method as PaymentMethod,
    reservation_status: data.status as ReservationStatus,
    payment,
  };
}

export type MarkCashPaymentSucceededResult = "updated" | "already_succeeded";

/** 現金精算: payments.status pending → succeeded + paid_at（service_role のみ） */
export async function markCashPaymentSucceededByReservationId(
  reservationId: string,
  paidAt: string,
): Promise<MarkCashPaymentSucceededResult> {
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from("payments")
    .select("status")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!existing) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  if (existing.status === "succeeded") {
    return "already_succeeded";
  }

  if (existing.status !== "pending") {
    throw new Error("INVALID_PAYMENT_STATUS");
  }

  const { data: updated, error: updateError } = await admin
    .from("payments")
    .update({
      status: "succeeded",
      paid_at: paidAt,
    })
    .eq("reservation_id", reservationId)
    .eq("status", "pending")
    .select("id");

  if (updateError) {
    throw new Error(updateError.message);
  }

  if ((updated ?? []).length > 0) {
    return "updated";
  }

  const { data: afterRace } = await admin
    .from("payments")
    .select("status")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (afterRace?.status === "succeeded") {
    return "already_succeeded";
  }

  throw new Error("PAYMENT_UPDATE_FAILED");
}

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { sendPaymentConfirmedEmails } from "@/lib/email/payment-confirmation-emails";
import {
  getWebhookSkipReasonForCashOrNonPending,
  shouldConfirmReservationViaStripeWebhook,
} from "@/lib/reservations/checkout-eligibility";
import { inferPaymentMethod } from "@/lib/reservations/payment-method";
import { findReservationPaymentEmailMetaById } from "@/lib/repositories/reservations.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import type { ReservationStatus } from "@/types/database";

export const dynamic = "force-dynamic";

function skipReasonForStatus(status: ReservationStatus): string {
  if (status === "expired") {
    return "expired";
  }
  if (status === "confirmed" || status === "cancelled") {
    return "already_processed";
  }
  return "concurrent_state_change";
}

function skippedResponse(reason: string, status?: ReservationStatus) {
  return NextResponse.json({
    received: true,
    skipped: true,
    reason,
    ...(status ? { status } : {}),
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });
  }

  const stripe = getStripe();
  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const reservationId = session.metadata?.reservationId;
    const userId = session.metadata?.userId;

    if (!reservationId || !userId) {
      console.warn("[stripe webhook] missing metadata", session.metadata);
      return skippedResponse("missing_metadata");
    }

    const admin = createAdminClient();

    const { data: reservation, error: fetchError } = await admin
      .from("reservations")
      .select("id, user_id, status, total_amount_yen, payment_method")
      .eq("id", reservationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("[stripe webhook] fetch reservation failed:", fetchError.message);
      return NextResponse.json({ error: "Failed to fetch reservation" }, { status: 500 });
    }

    if (!reservation) {
      console.warn("[stripe webhook] reservation not found", { reservationId, userId });
      return skippedResponse("not_found");
    }

    const paymentMethod = inferPaymentMethod(reservation);

    if (!shouldConfirmReservationViaStripeWebhook({
      payment_method: paymentMethod,
      status: reservation.status as ReservationStatus,
    })) {
      const reason = getWebhookSkipReasonForCashOrNonPending({
        payment_method: paymentMethod,
        status: reservation.status as ReservationStatus,
      });
      console.info(
        `[stripe webhook] skip confirm: reservation ${reservationId} payment_method=${paymentMethod} status=${reservation.status}`,
      );
      return skippedResponse(reason, reservation.status as ReservationStatus);
    }

    // pending のみ更新。.select() は配列を返す（single/maybeSingle は使わない）
    const { data: updatedRows, error: updateError } = await admin
      .from("reservations")
      .update({
        status: "confirmed",
        stripe_checkout_session_id: session.id,
      })
      .eq("id", reservationId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("id");

    if (updateError) {
      console.error("[stripe webhook] confirm update failed:", updateError.message);
      return NextResponse.json({ error: "Failed to confirm reservation" }, { status: 500 });
    }

    const updatedCount = updatedRows?.length ?? 0;

    if (updatedCount === 0) {
      const { data: current } = await admin
        .from("reservations")
        .select("status")
        .eq("id", reservationId)
        .eq("user_id", userId)
        .maybeSingle();

      const currentStatus = current?.status as ReservationStatus | undefined;
      const reason = currentStatus
        ? skipReasonForStatus(currentStatus)
        : "concurrent_state_change";

      console.info(
        `[stripe webhook] skip confirm: reservation ${reservationId} updated 0 rows (status=${currentStatus ?? "unknown"})`,
      );

      return skippedResponse(reason, currentStatus);
    }

    const { error: paymentError } = await admin.from("payments").upsert(
      {
        reservation_id: reservationId,
        stripe_checkout_session_id: session.id,
        amount_yen: session.amount_total ?? reservation.total_amount_yen,
        currency: session.currency ?? "jpy",
        status: "succeeded",
        paid_at: new Date().toISOString(),
      },
      { onConflict: "reservation_id" },
    );

    if (paymentError) {
      console.error("[stripe webhook] payment upsert failed:", paymentError.message);
      return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
    }

    const emailMeta = await findReservationPaymentEmailMetaById(reservationId, userId);
    if (emailMeta) {
      void sendPaymentConfirmedEmails({
        reservationId: emailMeta.reservationId,
        customerUserId: emailMeta.userId,
        spotName: emailMeta.spotName,
        businessId: emailMeta.businessId,
        planName: emailMeta.planName,
        reservationDate: emailMeta.reservationDate,
        startTime: emailMeta.startTime,
        endTime: emailMeta.endTime,
        guestCount: emailMeta.guestCount,
        totalAmountYen: session.amount_total ?? emailMeta.totalAmountYen,
      }).catch((err) => {
        console.warn("[stripe webhook] payment confirmation email error:", err);
      });
    } else {
      console.warn(
        "[stripe webhook] payment confirmation email skipped: reservation meta not found",
        { reservationId, userId },
      );
    }

    return NextResponse.json({ received: true, confirmed: true, reservationId });
  }

  return NextResponse.json({ received: true });
}

import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { getReservationById } from "@/lib/reservations/get-reservation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { checkoutSchema } from "@/validations/reservation";

export const dynamic = "force-dynamic";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reservation = await getReservationById(parsed.data.reservation_id, user.id);

    if (!reservation) {
      return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
    }

    if (reservation.status !== "pending") {
      return NextResponse.json(
        { error: "この予約は決済できません" },
        { status: 422 },
      );
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("reservations")
      .select("id")
      .eq("plan_id", reservation.plan_id)
      .eq("reservation_date", reservation.reservation_date)
      .eq("start_time", reservation.start_time)
      .eq("status", "confirmed")
      .neq("id", reservation.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "この日時はすでに予約済みです" },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    const spotName = reservation.fishing_spots?.name ?? "釣り場";
    const planName = reservation.plans?.name ?? "プラン";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: `${spotName} - ${planName}`,
              description: `${reservation.reservation_date} ${reservation.start_time}`,
            },
            unit_amount: reservation.total_amount_yen,
          },
          quantity: 1,
        },
      ],
      metadata: {
        reservationId: reservation.id,
        userId: user.id,
        planId: reservation.plan_id,
        date: reservation.reservation_date,
        time: reservation.start_time.slice(0, 5),
      },
      success_url: `${appUrl()}/reserve/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/reservation/confirm/${reservation.id}`,
    });

    await admin
      .from("reservations")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", reservation.id)
      .eq("user_id", user.id);

    return NextResponse.json({ checkout_url: session.url, url: session.url });
  } catch (error) {
    console.error("[checkout]", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}

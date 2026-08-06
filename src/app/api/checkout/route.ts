import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { evaluateStripeCheckoutEligibility } from "@/lib/reservations/checkout-eligibility";
import { inferPaymentMethod } from "@/lib/reservations/payment-method";
import { getReservationById } from "@/lib/reservations/get-reservation";
import { getReservationPlanDisplay } from "@/lib/reservations/plan-display";
import { updateReservationStripeCheckoutSessionId } from "@/lib/repositories/reservations.repository";
import { getActiveAddonAmountSummary } from "@/lib/services/reservation-addon.service";
import { getStripe } from "@/lib/stripe/server";
import { checkoutSchema } from "@/validations/reservation";
import type Stripe from "stripe";

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

    const eligibility = evaluateStripeCheckoutEligibility({
      payment_method: inferPaymentMethod(reservation),
      status: reservation.status,
      expires_at: reservation.expires_at,
    });

    if (!eligibility.ok) {
      return NextResponse.json({ error: eligibility.error }, { status: eligibility.status });
    }

    const stripe = getStripe();
    const spotName = reservation.locations?.name ?? "釣り場";
    const planName = getReservationPlanDisplay(reservation, { nameFallback: "プラン" }).name;

    // アドオン（同時購入商品）は決済方法を予約と2重に選ばせないため、同じ
    // Checkout Session に1行にまとめて含める（product_id ごとの line_item に
    // 分けると単価の税込み丸めが数量倍で誤差を生むため、合計額で1行にする）。
    const addonSummary = await getActiveAddonAmountSummary(reservation.id);
    const addonLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      addonSummary.totalAmount > 0
        ? [
            {
              price_data: {
                currency: "jpy",
                product_data: { name: "追加商品（同時購入）" },
                unit_amount: addonSummary.totalAmount,
              },
              quantity: 1,
            },
          ]
        : [];

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
        ...addonLineItems,
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

    try {
      await updateReservationStripeCheckoutSessionId(
        reservation.id,
        user.id,
        session.id,
      );
    } catch (updateError) {
      // 従来どおり session_id 更新失敗でも Checkout URL は返す
      console.error("[checkout] stripe_checkout_session_id update failed:", updateError);
    }

    return NextResponse.json({ checkout_url: session.url, url: session.url });
  } catch (error) {
    console.error("[checkout]", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}

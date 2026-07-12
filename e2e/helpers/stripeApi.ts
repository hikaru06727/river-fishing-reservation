import Stripe from "stripe";

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("[stripeApi] STRIPE_SECRET_KEY が未設定です。");
  }
  return new Stripe(secretKey);
}

export async function getPaymentIntentIdForSession(sessionId: string): Promise<string> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) {
    throw new Error(`[getPaymentIntentIdForSession] session ${sessionId} に payment_intent がありません`);
  }
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

export async function listRefundsForPaymentIntent(
  paymentIntentId: string,
): Promise<Stripe.Refund[]> {
  const stripe = getStripeClient();
  const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 10 });
  return refunds.data;
}

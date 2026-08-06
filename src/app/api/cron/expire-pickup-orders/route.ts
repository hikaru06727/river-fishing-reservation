import { NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/cron/verify-cron-secret";
import { expirePickupOrders } from "@/lib/services/online-order.service";

const ROUTE_LABEL = "expire-pickup-orders";

async function handleExpirePickupOrders(request: Request) {
  const secretValidation = validateCronSecret(request);
  if (!secretValidation.ok) {
    const status = secretValidation.reason === "missing_env" ? 503 : 401;
    console.warn(`[${ROUTE_LABEL}] unauthorized cron request:`, secretValidation.reason);
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const cancelledCount = await expirePickupOrders();
    return NextResponse.json({ ok: true, cancelledCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[${ROUTE_LABEL}]`, message);
    return NextResponse.json({ error: "Failed to expire pickup orders" }, { status: 500 });
  }
}

// Vercel Cron は GET でのみ呼び出すため GET を用意し、外部 cron / 手動テスト用に POST も残す。
export const GET = handleExpirePickupOrders;
export const POST = handleExpirePickupOrders;

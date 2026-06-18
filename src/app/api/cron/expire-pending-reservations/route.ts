import { NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/cron/verify-cron-secret";
import { processExpirePendingReservations } from "@/lib/services/expire-pending-reservations.service";

const ROUTE_LABEL = "expire-pending-reservations";

export async function POST(request: Request) {
  const secretValidation = validateCronSecret(request);
  if (!secretValidation.ok) {
    const status = secretValidation.reason === "missing_env" ? 503 : 401;
    console.warn(`[${ROUTE_LABEL}] unauthorized cron request:`, secretValidation.reason);
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  try {
    const result = await processExpirePendingReservations();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[${ROUTE_LABEL}]`, message);
    return NextResponse.json({ error: "Failed to process expired reservations" }, { status: 500 });
  }
}

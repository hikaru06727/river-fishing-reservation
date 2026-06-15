import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { cancelReservation } from "@/lib/services/reservations.service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(_request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const result = await cancelReservation(user.id, { reservationId: id });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    reservation: { id: result.data.reservationId, status: "cancelled" },
    refund_initiated: false,
  });
}

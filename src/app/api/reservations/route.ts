import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { createReservation } from "@/lib/services/reservations.service";
import type { CreateReservationRequest } from "@/types/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateReservationRequest;

  const result = await createReservation(user.id, {
    spotId: body.spot_id,
    planId: body.plan_id,
    slotId: body.slot_id,
    reservationDate: body.reservation_date,
    guestCount: body.guest_count ?? 1,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      reservation: {
        id: result.data.reservationId,
        redirect_path: result.data.redirectPath,
      },
    },
    { status: 201 },
  );
}

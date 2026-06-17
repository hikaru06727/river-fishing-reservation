import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { findReservationByIdForUser } from "@/lib/repositories/reservations.repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const reservation = await findReservationByIdForUser(id, user.id);

    if (!reservation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ reservation });
  } catch {
    // 従来 .single() の error 時と同様 404
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

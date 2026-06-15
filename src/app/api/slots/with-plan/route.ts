import { NextResponse } from "next/server";
import { getAvailableSlotsWithPlan } from "@/lib/services/slots.service";

export const dynamic = "force-dynamic";

/**
 * プラン別空き枠 API。
 *
 * レスポンスの `remaining_count` は影響スロット群の min(max_capacity - booked_count)。
 * 算出ロジックは slots.service → computeRemainingCount のみ（再定義禁止）。
 */
export async function GET(request: Request) {  const { searchParams } = new URL(request.url);
  const spotId = searchParams.get("spot_id");
  const planId = searchParams.get("plan_id");
  const date = searchParams.get("date") ?? undefined;
  const guestCount = Number(searchParams.get("guest_count") ?? "1");

  if (!spotId || !planId) {
    return NextResponse.json(
      { error: "spot_id and plan_id are required" },
      { status: 400 },
    );
  }

  if (!Number.isInteger(guestCount) || guestCount < 1) {
    return NextResponse.json(
      { error: "guest_count must be a positive integer" },
      { status: 400 },
    );
  }

  try {
    const data = await getAvailableSlotsWithPlan({
      spotId,
      planId,
      guestCount,
      date,
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("見つかりません") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

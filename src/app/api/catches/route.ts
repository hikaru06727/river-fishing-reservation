import { NextResponse } from "next/server";
import { findPublishedCatchReportsPaginated } from "@/lib/repositories/catch-reports.repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const spotId = searchParams.get("spot_id");
  const page = Number(searchParams.get("page") ?? "1");
  const limit = 10;
  const offset = (page - 1) * limit;

  try {
    const { rows, totalCount } = await findPublishedCatchReportsPaginated({
      spotId,
      offset,
      limit,
    });
    return NextResponse.json({ catches: rows, total: totalCount, page, limit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

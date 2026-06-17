import { NextResponse } from "next/server";
import { findPublishedCatchReportFullById } from "@/lib/repositories/catch-reports.repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const item = await findPublishedCatchReportFullById(id);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ catch: item });
}

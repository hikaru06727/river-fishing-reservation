import { NextResponse } from "next/server";
import { findActiveSpotFullBySlug } from "@/lib/repositories/fishing-spots.repository";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;

  const spot = await findActiveSpotFullBySlug(slug);

  if (!spot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ spot });
}

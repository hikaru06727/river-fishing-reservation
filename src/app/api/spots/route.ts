import { NextResponse } from "next/server";
import { findActiveSpotsFull } from "@/lib/repositories/fishing-spots.repository";

export async function GET() {
  try {
    const spots = await findActiveSpotsFull();
    return NextResponse.json({ spots });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

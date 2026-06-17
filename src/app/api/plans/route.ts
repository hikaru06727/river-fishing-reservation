import { NextResponse } from "next/server";
import { findAllActivePlans } from "@/lib/repositories/plans.repository";

export async function GET() {
  try {
    const plans = await findAllActivePlans();
    return NextResponse.json({ plans });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const spotId = searchParams.get("spot_id");
  const page = Number(searchParams.get("page") ?? "1");
  const limit = 10;
  const offset = (page - 1) * limit;

  const supabase = await createClient();
  let query = supabase
    .from("catch_reports")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (spotId) {
    query = query.eq("spot_id", spotId);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ catches: data, total: count, page, limit });
}

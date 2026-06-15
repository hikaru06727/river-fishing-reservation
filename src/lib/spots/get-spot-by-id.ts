import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { FishingSpot } from "@/types/database";

export type SpotSummary = Pick<FishingSpot, "id" | "name" | "slug">;

export const getSpotById = cache(async (id: string): Promise<SpotSummary | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spots")
    .select("id, name, slug")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[getSpotById]", error.message);
    throw new Error("釣り場データの取得に失敗しました。");
  }

  return data;
});

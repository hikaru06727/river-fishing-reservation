import { createClient } from "@/lib/supabase/server";
import type { FishingSpot } from "@/types/database";

export type SpotListItem = Pick<
  FishingSpot,
  "id" | "name" | "slug" | "description" | "prefecture" | "image_url"
>;

export async function getActiveSpots(): Promise<SpotListItem[]> {
  console.log("[getActiveSpots] 取得開始");

  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error("[getActiveSpots] createClient 失敗:", err);
    throw err;
  }

  const { data, error } = await supabase
    .from("fishing_spots")
    .select("id, name, slug, description, prefecture, image_url")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[getActiveSpots] Supabase クエリエラー:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error("釣り場データの取得に失敗しました。しばらくしてから再度お試しください。");
  }

  console.log("[getActiveSpots] 取得成功:", data?.length ?? 0, "件");
  return data ?? [];
}

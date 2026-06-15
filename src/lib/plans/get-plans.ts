import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/types/database";

export async function getActivePlans(): Promise<Plan[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("duration_minutes", { ascending: true });

  if (error) {
    console.error("[getActivePlans]", error.message);
    throw new Error("プラン情報の取得に失敗しました。");
  }

  return data ?? [];
}

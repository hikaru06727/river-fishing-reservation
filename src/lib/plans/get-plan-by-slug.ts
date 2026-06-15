import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/types/database";

export const getPlanBySlug = cache(async (slug: string): Promise<Plan | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[getPlanBySlug]", error.message);
    throw new Error("プラン情報の取得に失敗しました。");
  }

  return data;
});

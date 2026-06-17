import { cache } from "react";
import { findActivePlanBySlug } from "@/lib/repositories/plans.repository";
import type { Plan } from "@/types/database";

export const getPlanBySlug = cache(async (slug: string): Promise<Plan | null> => {
  try {
    return await findActivePlanBySlug(slug);
  } catch (error) {
    console.error("[getPlanBySlug]", error instanceof Error ? error.message : error);
    throw new Error("プラン情報の取得に失敗しました。");
  }
});

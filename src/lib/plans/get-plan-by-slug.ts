import { cache } from "react";
import {
  findActivePlanBySlugForSpot,
} from "@/lib/repositories/plans.repository";
import type { Plan } from "@/types/database";

export const getPlanBySlugForSpot = cache(
  async (slug: string, spotId: string): Promise<Plan | null> => {
    try {
      return await findActivePlanBySlugForSpot(slug, spotId);
    } catch (error) {
      console.error(
        "[getPlanBySlugForSpot]",
        error instanceof Error ? error.message : error,
      );
      throw new Error("プラン情報の取得に失敗しました。");
    }
  },
);

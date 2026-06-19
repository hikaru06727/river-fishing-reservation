import { findAllActivePlans, findBookablePlansBySpotId } from "@/lib/repositories/plans.repository";
import type { Plan } from "@/types/database";

export async function getActivePlans(): Promise<Plan[]> {
  try {
    return await findAllActivePlans();
  } catch (error) {
    console.error("[getActivePlans]", error instanceof Error ? error.message : error);
    throw new Error("プラン情報の取得に失敗しました。");
  }
}

export async function getBookablePlansBySpotId(spotId: string): Promise<Plan[]> {
  try {
    return await findBookablePlansBySpotId(spotId);
  } catch (error) {
    console.error(
      "[getBookablePlansBySpotId]",
      error instanceof Error ? error.message : error,
    );
    throw new Error("プラン情報の取得に失敗しました。");
  }
}

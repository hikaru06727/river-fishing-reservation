import { findAllActivePlans } from "@/lib/repositories/plans.repository";
import type { Plan } from "@/types/database";

export async function getActivePlans(): Promise<Plan[]> {
  try {
    return await findAllActivePlans();
  } catch (error) {
    console.error("[getActivePlans]", error instanceof Error ? error.message : error);
    throw new Error("プラン情報の取得に失敗しました。");
  }
}

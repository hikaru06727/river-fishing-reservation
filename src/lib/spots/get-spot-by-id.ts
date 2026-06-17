import { cache } from "react";
import {
  findActiveSpotSummaryById,
  type SpotSummaryRow,
} from "@/lib/repositories/fishing-spots.repository";

export type SpotSummary = SpotSummaryRow;

export const getSpotById = cache(async (id: string): Promise<SpotSummary | null> => {
  try {
    return await findActiveSpotSummaryById(id);
  } catch (error) {
    console.error("[getSpotById]", error instanceof Error ? error.message : error);
    throw new Error("釣り場データの取得に失敗しました。");
  }
});

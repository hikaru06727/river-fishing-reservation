import { cache } from "react";
import {
  findActiveSpotDetailBySlug,
  type SpotDetailRow,
} from "@/lib/repositories/fishing-spots.repository";

export type SpotDetail = SpotDetailRow;

export const getSpotBySlug = cache(async (slug: string): Promise<SpotDetail | null> => {
  try {
    return await findActiveSpotDetailBySlug(slug);
  } catch (error) {
    console.error("[getSpotBySlug]", error instanceof Error ? error.message : error);
    throw new Error("釣り場データの取得に失敗しました。");
  }
});

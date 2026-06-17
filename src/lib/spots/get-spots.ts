import {
  findActiveSpots,
  type SpotListItem,
} from "@/lib/repositories/fishing-spots.repository";

export type { SpotListItem };

export async function getActiveSpots(): Promise<SpotListItem[]> {
  console.log("[getActiveSpots] 取得開始");

  try {
    const data = await findActiveSpots();
    console.log("[getActiveSpots] 取得成功:", data.length, "件");
    return data;
  } catch (err) {
    console.error("[getActiveSpots] 取得失敗:", err);
    throw new Error("釣り場データの取得に失敗しました。しばらくしてから再度お試しください。");
  }
}

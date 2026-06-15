import type { SlotDTO } from "@/types/api";

/** UI 表示用: slots 配列を日付別にグループ（API レスポンスには含めない） */
export function groupSlotsByDate(
  slots: SlotDTO[],
): Record<string, SlotDTO[]> {
  return slots.reduce<Record<string, SlotDTO[]>>((acc, slot) => {
    if (!acc[slot.date]) {
      acc[slot.date] = [];
    }
    acc[slot.date]!.push(slot);
    return acc;
  }, {});
}

/** UI 表示用: 利用可能な日付一覧（昇順） */
export function getUniqueSlotDates(slots: SlotDTO[]): string[] {
  return [...new Set(slots.map((s) => s.date))].sort();
}

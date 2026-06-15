/**
 * ## remaining_count の唯一の定義
 *
 * ```
 * remaining_count = min( max_capacity - booked_count )  // 影響スロット群すべてに対する最小値
 * ```
 *
 * マルチスロットプラン（例: 3時間 = 09:00, 10:00, 11:00）では、
 * 開始スロット単体の残枠ではなく **ボトルネックとなる最小残枠** が正しい値。
 *
 * ### ルール
 * - 計算は `computeRemainingCount` のみで行う（UI・API・service 共通）
 * - UI は API レスポンスの `remaining_count` をそのまま表示する（再計算禁止）
 * - 単一 hourly スロットの `max_capacity - booked_count` を remaining_count として
 *   返してはならない
 *
 * @see computeRemainingCount
 * @see getSlotRemainingCapacity
 */
export type RemainingCount = number;

type SlotCapacityFields = {
  max_capacity: number;
  booked_count: number;
};

/** 1 スロットあたりの残枠（remaining_count の構成要素。集約には computeRemainingCount を使う） */
export function getSlotRemainingCapacity(slot: SlotCapacityFields): number {
  return slot.max_capacity - slot.booked_count;
}

/**
 * 影響スロット群の remaining_count を算出する唯一の関数。
 *
 * @returns 影響スロット群のうち最も小さい (max_capacity - booked_count)。スロットが空なら 0。
 */
export function computeRemainingCount(
  slots: ReadonlyArray<SlotCapacityFields>,
): RemainingCount {
  if (slots.length === 0) {
    return 0;
  }

  return Math.min(...slots.map(getSlotRemainingCapacity));
}

/**
 * guestCount が remaining_count 以下か（= 全影響スロットに収まるか）を判定。
 * validateAffectedSlotsCapacity の補助。エラーメッセージ付き検証はそちらを使用。
 */
export function fitsWithinRemainingCount(
  slots: ReadonlyArray<SlotCapacityFields>,
  guestCount: number,
): boolean {
  return guestCount <= computeRemainingCount(slots);
}

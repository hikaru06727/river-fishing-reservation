export const SLOT_STEP_MINUTES = 15;
export const LEGACY_SLOT_STEP_MINUTES = 60;
export const SUPPORTED_SLOT_STEPS = [SLOT_STEP_MINUTES, LEGACY_SLOT_STEP_MINUTES] as const;

export type SupportedSlotStepMinutes = (typeof SUPPORTED_SLOT_STEPS)[number];

/** "09:00", "09:00:00", "09:00:00+00" 等から分（0:00 起点）を算出 */
export function parseTimeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return null;
  }
  const hour = parseInt(match[1]!, 10);
  const minute = parseInt(match[2]!, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

/**
 * availability_slots 行の start/end から slot step（分）を判定。
 * 15 分 grid / legacy hourly のみ対応。それ以外は null。
 */
export function slotStepMinutesFromSlotRow(
  startTime: string,
  endTime: string,
): SupportedSlotStepMinutes | null {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
    return null;
  }

  const diff = endMinutes - startMinutes;
  if (diff === SLOT_STEP_MINUTES) {
    return SLOT_STEP_MINUTES;
  }
  if (diff === LEGACY_SLOT_STEP_MINUTES) {
    return LEGACY_SLOT_STEP_MINUTES;
  }
  return null;
}

export function isSupportedSlotStepMinutes(value: number): value is SupportedSlotStepMinutes {
  return (SUPPORTED_SLOT_STEPS as readonly number[]).includes(value);
}

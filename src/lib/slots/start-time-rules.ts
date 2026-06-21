import { getAffectedSlotStartTimes } from "@/lib/slots/affected-slots";
import { LEGACY_SLOT_STEP_MINUTES } from "@/lib/slots/slot-step";

/** 予約可能な hourly 枠（昼休み 12:00 台を除く。legacy 1h/3h と同等） */
export const BOOKABLE_HOUR_SLOTS = [9, 10, 11, 13, 14, 15] as const;

/** バリデーション用に "09:00" → "9:00" 形式へ正規化 */
export function normalizeTimeInput(time: string): string {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return time;
  }
  return `${parseInt(match[1]!, 10)}:${match[2]}`;
}

function parseHourFromTime(time: string): number | null {
  const normalized = normalizeTimeInput(time);
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hour = parseInt(match[1]!, 10);
  const minute = parseInt(match[2]!, 10);
  if (minute !== 0) {
    return null;
  }
  return hour;
}

function isBookableHour(hour: number): boolean {
  return (BOOKABLE_HOUR_SLOTS as readonly number[]).includes(hour);
}

/**
 * duration_minutes に基づき開始時刻が予約可能か判定する。
 * getAffectedSlotStartTimes と整合し、影響する全 hourly 枠が BOOKABLE_HOUR_SLOTS 内である必要がある。
 */
export function isAllowedStartTimeByDuration(
  durationMinutes: number,
  startTime: string,
): boolean {
  if (durationMinutes <= 0 || durationMinutes % 60 !== 0) {
    return false;
  }

  if (parseHourFromTime(startTime) === null) {
    return false;
  }

  const affectedTimes = getAffectedSlotStartTimes(
    startTime,
    durationMinutes,
    LEGACY_SLOT_STEP_MINUTES,
  );
  if (affectedTimes.length === 0) {
    return false;
  }

  return affectedTimes.every((time) => {
    const hour = parseHourFromTime(time);
    return hour !== null && isBookableHour(hour);
  });
}

/** legacy reservationSchema 用: slug → duration_minutes */
export function durationMinutesFromLegacyPlanSlug(slug: string): number {
  return slug === "3h" ? 180 : 60;
}

/** @deprecated plan.duration_minutes と isAllowedStartTimeByDuration を使用 */
export function isAllowedStartTime(planSlug: string, startTime: string): boolean {
  return isAllowedStartTimeByDuration(
    durationMinutesFromLegacyPlanSlug(planSlug),
    startTime,
  );
}

import { getAffectedSlotStartTimes } from "@/lib/slots/affected-slots";
import { LEGACY_SLOT_STEP_MINUTES } from "@/lib/slots/slot-step";

/**
 * legacy hourly seed 互換: 予約可能な時刻（時）の allowlist。
 * Phase 9 暫定 seed の 06:00 等を候補から除外するためのみ使用。
 * 営業時間ルールではない — Phase 10 で DB 化するまでの暫定互換。
 */
export const LEGACY_BOOKABLE_HOUR_SLOTS = [9, 10, 11, 13, 14, 15] as const;

/** @deprecated LEGACY_BOOKABLE_HOUR_SLOTS を使用 */
export const BOOKABLE_HOUR_SLOTS = LEGACY_BOOKABLE_HOUR_SLOTS;

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

function isLegacyBookableHour(hour: number): boolean {
  return (LEGACY_BOOKABLE_HOUR_SLOTS as readonly number[]).includes(hour);
}

/**
 * legacy hourly（step=60）専用: duration と開始時刻が予約可能か判定。
 * 影響する全 hourly 枠が LEGACY_BOOKABLE_HOUR_SLOTS 内である必要がある。
 * 15分 grid では使用しない — 候補可否は availability_slots の存在で判断する。
 */
export function isAllowedLegacyHourlyStartTimeByDuration(
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
    return hour !== null && isLegacyBookableHour(hour);
  });
}

/** @deprecated isAllowedLegacyHourlyStartTimeByDuration を使用（legacy hourly 専用） */
export function isAllowedStartTimeByDuration(
  durationMinutes: number,
  startTime: string,
): boolean {
  return isAllowedLegacyHourlyStartTimeByDuration(durationMinutes, startTime);
}

/** legacy reservationSchema 用: slug → duration_minutes */
export function durationMinutesFromLegacyPlanSlug(slug: string): number {
  return slug === "3h" ? 180 : 60;
}

/** @deprecated plan.duration_minutes と isAllowedLegacyHourlyStartTimeByDuration を使用 */
export function isAllowedStartTime(planSlug: string, startTime: string): boolean {
  return isAllowedLegacyHourlyStartTimeByDuration(
    durationMinutesFromLegacyPlanSlug(planSlug),
    startTime,
  );
}

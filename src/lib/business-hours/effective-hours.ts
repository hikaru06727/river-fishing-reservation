export type WeeklyHourInput = {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  is_24_hours: boolean;
};

export type DateExceptionInput = {
  exception_date: string;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  is_24_hours: boolean;
  note: string | null;
};

export type EffectiveBusinessHours =
  | { isConfigured: false }
  | {
      isConfigured: true;
      isOpen: boolean;
      is24Hours: boolean;
      openTime: string | null;
      closeTime: string | null;
      source: "weekly" | "exception";
    };

function normalizeTimeValue(time: string | null | undefined): string | null {
  if (time == null || time.length === 0) {
    return null;
  }
  return time.slice(0, 5);
}

export function parseTimeToMinutes(time: string): number | null {
  const normalized = normalizeTimeValue(time);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = parseInt(match[1]!, 10);
  const minute = parseInt(match[2]!, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

/** weekly_hours に 1 行以上あれば営業時間設定済み */
export function hasBusinessHoursConfigured(weeklyHours: readonly WeeklyHourInput[]): boolean {
  return weeklyHours.length > 0;
}

/** YYYY-MM-DD → day_of_week（0=日曜 … 6=土曜） */
export function getDayOfWeekFromDate(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}

/**
 * 特定日の有効営業時間を解決する。
 * 優先: exception → weekly →（weekly 未設定なら isConfigured=false）
 */
export function getEffectiveBusinessHoursForDate(
  weeklyHours: readonly WeeklyHourInput[],
  exceptions: readonly DateExceptionInput[],
  date: string,
): EffectiveBusinessHours {
  if (!hasBusinessHoursConfigured(weeklyHours)) {
    return { isConfigured: false };
  }

  const exception = exceptions.find((row) => row.exception_date === date);
  if (exception) {
    return {
      isConfigured: true,
      isOpen: exception.is_open,
      is24Hours: exception.is_24_hours,
      openTime: normalizeTimeValue(exception.open_time),
      closeTime: normalizeTimeValue(exception.close_time),
      source: "exception",
    };
  }

  const dayOfWeek = getDayOfWeekFromDate(date);
  const weekly = weeklyHours.find((row) => row.day_of_week === dayOfWeek);
  if (!weekly) {
    return {
      isConfigured: true,
      isOpen: false,
      is24Hours: false,
      openTime: null,
      closeTime: null,
      source: "weekly",
    };
  }

  return {
    isConfigured: true,
    isOpen: weekly.is_open,
    is24Hours: weekly.is_24_hours,
    openTime: normalizeTimeValue(weekly.open_time),
    closeTime: normalizeTimeValue(weekly.close_time),
    source: "weekly",
  };
}

/**
 * 予約開始・終了が営業時間内か判定する。
 * 未設定 spot（isConfigured=false）は常に true（既存挙動維持）。
 */
export function isReservationWithinBusinessHours(
  effective: EffectiveBusinessHours,
  startTime: string,
  durationMinutes: number,
): boolean {
  if (!effective.isConfigured) {
    return true;
  }

  if (!effective.isOpen) {
    return false;
  }

  if (effective.is24Hours) {
    return durationMinutes > 0;
  }

  if (!effective.openTime || !effective.closeTime) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const openMinutes = parseTimeToMinutes(effective.openTime);
  const closeMinutes = parseTimeToMinutes(effective.closeTime);

  if (startMinutes == null || openMinutes == null || closeMinutes == null) {
    return false;
  }

  if (durationMinutes <= 0) {
    return false;
  }

  const endMinutes = startMinutes + durationMinutes;
  return startMinutes >= openMinutes && endMinutes <= closeMinutes;
}

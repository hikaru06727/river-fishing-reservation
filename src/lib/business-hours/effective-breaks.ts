import {
  getDayOfWeekFromDate,
  parseTimeToMinutes,
  type DateExceptionInput,
} from "@/lib/business-hours/effective-hours";

export type WeeklyBreakInput = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  label?: string | null;
};

export type ExceptionBreakInput = {
  date_exception_id: string;
  start_time: string;
  end_time: string;
  label?: string | null;
};

export type DateExceptionWithBreakMeta = DateExceptionInput & {
  id: string;
  ignore_weekly_breaks: boolean;
};

export type BreakInterval = {
  startTime: string;
  endTime: string;
  label?: string | null;
};

function normalizeTimeValue(time: string | null | undefined): string | null {
  if (time == null || time.length === 0) {
    return null;
  }
  return time.slice(0, 5);
}

function toBreakInterval(row: {
  start_time: string;
  end_time: string;
  label?: string | null;
}): BreakInterval {
  return {
    startTime: normalizeTimeValue(row.start_time)!,
    endTime: normalizeTimeValue(row.end_time)!,
    label: row.label ?? null,
  };
}

/** spot に休み時間が 1 件以上あれば true */
export function hasBreaksConfigured(
  weeklyBreaks: readonly WeeklyBreakInput[],
  exceptionBreaks: readonly ExceptionBreakInput[],
): boolean {
  return weeklyBreaks.length > 0 || exceptionBreaks.length > 0;
}

/**
 * 時間帯 [start, end) の半開区間として重なりを判定する。
 * reservationStart < breakEnd && reservationEnd > breakStart
 */
export function intervalsOverlapMinutes(
  reservationStartMinutes: number,
  reservationEndMinutes: number,
  breakStartMinutes: number,
  breakEndMinutes: number,
): boolean {
  return (
    reservationStartMinutes < breakEndMinutes &&
    reservationEndMinutes > breakStartMinutes
  );
}

export function isReservationOverlappingBreaks(
  startTime: string,
  durationMinutes: number,
  breaks: readonly BreakInterval[],
): boolean {
  if (breaks.length === 0 || durationMinutes <= 0) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(startTime);
  if (startMinutes == null) {
    return true;
  }

  const endMinutes = startMinutes + durationMinutes;

  for (const breakInterval of breaks) {
    const breakStart = parseTimeToMinutes(breakInterval.startTime);
    const breakEnd = parseTimeToMinutes(breakInterval.endTime);
    if (breakStart == null || breakEnd == null) {
      continue;
    }
    if (intervalsOverlapMinutes(startMinutes, endMinutes, breakStart, breakEnd)) {
      return true;
    }
  }

  return false;
}

/**
 * 特定日に適用する休み時間一覧を解決する。
 *
 * - 例外日が休業 (is_open=false) → 空（呼び出し元で営業時間判定済み想定）
 * - 例外日に exception_breaks あり → exception_breaks のみ
 * - 例外日が営業かつ ignore_weekly_breaks → 空
 * - 例外日が営業かつ exception_breaks なしかつ !ignore_weekly_breaks → 曜日別を継承
 * - 例外日なし → 曜日別
 */
export function getEffectiveBreaksForDate(
  weeklyBreaks: readonly WeeklyBreakInput[],
  exceptionBreaks: readonly ExceptionBreakInput[],
  dateExceptions: readonly DateExceptionWithBreakMeta[],
  date: string,
): BreakInterval[] {
  const exception = dateExceptions.find((row) => row.exception_date === date);

  if (exception) {
    if (!exception.is_open) {
      return [];
    }

    const exceptionDayBreaks = exceptionBreaks
      .filter((row) => row.date_exception_id === exception.id)
      .map(toBreakInterval);

    if (exceptionDayBreaks.length > 0) {
      return exceptionDayBreaks;
    }

    if (exception.ignore_weekly_breaks) {
      return [];
    }
  }

  const dayOfWeek = getDayOfWeekFromDate(date);
  return weeklyBreaks
    .filter((row) => row.day_of_week === dayOfWeek)
    .map(toBreakInterval);
}

/** 同一曜日・同一例外日内の時間帯重複を検出 */
export function findOverlappingBreakPair(
  breaks: readonly { startTime: string; endTime: string }[],
): { indexA: number; indexB: number } | null {
  const parsed = breaks.map((row) => ({
    start: parseTimeToMinutes(row.startTime),
    end: parseTimeToMinutes(row.endTime),
  }));

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i]!;
      const b = parsed[j]!;
      if (a.start == null || a.end == null || b.start == null || b.end == null) {
        continue;
      }
      if (intervalsOverlapMinutes(a.start, a.end, b.start, b.end)) {
        return { indexA: i, indexB: j };
      }
    }
  }

  return null;
}

export type ReservationDurationSource = {
  reserved_duration_minutes?: number | null;
  start_time: string;
  end_time: string;
};

function parseTimeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
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

/** reservation.start_time / end_time から duration（分）を算出 */
export function durationMinutesFromReservationTimes(
  startTime: string,
  endTime: string,
): number | null {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
    return null;
  }
  return endMinutes - startMinutes;
}

/**
 * キャンセル・枠戻し用 duration（分）。
 * 優先: reserved_duration_minutes → start/end 差分 → null
 */
export function resolveReservationDurationMinutes(
  source: ReservationDurationSource,
): number | null {
  if (
    source.reserved_duration_minutes != null &&
    source.reserved_duration_minutes > 0
  ) {
    return source.reserved_duration_minutes;
  }

  return durationMinutesFromReservationTimes(source.start_time, source.end_time);
}

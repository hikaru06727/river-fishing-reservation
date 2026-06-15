export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h! * 60 + m! + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export function toDbTime(time: string): string {
  const base = time.slice(0, 5);
  return `${base}:00`;
}

export function getDateRange(days: number): { start: string; end: string } {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + days - 1);
  return { start: toISODate(today), end: toISODate(end) };
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getAvailableDates(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(toISODate(d));
  }
  return dates;
}

const JST_OFFSET = "+09:00";

/** reservation_date + start_time を Asia/Tokyo 基準の Date に変換 */
export function getReservationStartAtJst(
  reservationDate: string,
  startTime: string,
): Date {
  const normalizedTime =
    startTime.length >= 8 ? startTime.slice(0, 8) : `${startTime.slice(0, 5)}:00`;
  return new Date(`${reservationDate}T${normalizedTime}${JST_OFFSET}`);
}

/** 一般ユーザー向けキャンセル期限（利用開始24時間前） */
export function getUserCancelDeadline(startAt: Date): Date {
  return new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
}

/** now < startAt - 24h のとき true（キャンセル可能） */
export function isBeforeUserCancelDeadline(
  startAt: Date,
  now: Date = new Date(),
): boolean {
  return now.getTime() < getUserCancelDeadline(startAt).getTime();
}

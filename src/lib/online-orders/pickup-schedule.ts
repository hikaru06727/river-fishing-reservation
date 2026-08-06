import { getTodayJst } from "@/lib/utils/date";

const PICKUP_DEADLINE_DAYS = 3;
const PICKUP_WINDOW_DAYS = 30;
const JST_OFFSET = "+09:00";

/** 09:00〜18:00 を30分刻みにした受け取り希望時刻の選択肢 */
export const PICKUP_TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let minutes = 9 * 60; minutes <= 18 * 60; minutes += 30) {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
  }
  return slots;
})();

export function isValidPickupTimeSlot(time: string): boolean {
  return PICKUP_TIME_SLOTS.includes(time);
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00${JST_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

/** 受け取り希望日の選択可能範囲（翌日以降・30日以内、JST基準） */
export function getPickupDateRange(): { min: string; max: string } {
  const today = getTodayJst();
  return {
    min: addDaysToIsoDate(today, 1),
    max: addDaysToIsoDate(today, PICKUP_WINDOW_DAYS),
  };
}

export function isPickupDateWithinWindow(isoDate: string): boolean {
  const { min, max } = getPickupDateRange();
  return isoDate >= min && isoDate <= max;
}

/** 受け取り希望日+時刻（JST）を timestamptz として保存可能な Date に変換 */
export function toPickupDateTime(isoDate: string, time: string): Date {
  return new Date(`${isoDate}T${time}:00${JST_OFFSET}`);
}

/** 受け取り期限（pickup_date + 3日） */
export function computePickupDeadline(pickupDateTime: Date): Date {
  return new Date(pickupDateTime.getTime() + PICKUP_DEADLINE_DAYS * 24 * 60 * 60 * 1000);
}

/** 指定 JST 暦日（YYYY-MM-DD）の UTC 範囲 [start, end) を返す。pickup_date の当日絞り込みに使う */
export function getJstDayRangeUtc(isoDate: string): { startUtc: string; endUtc: string } {
  const start = new Date(`${isoDate}T00:00:00${JST_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

/** pickup_date（ISO timestamptz）を JST の日付+時刻表示にする */
export function formatPickupDateTimeJst(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** pickup_date（ISO timestamptz）を JST の時刻のみ表示にする */
export function formatPickupTimeJst(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** pickup_deadline（ISO timestamptz）を JST の日付のみ表示にする */
export function formatPickupDeadlineDateJst(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

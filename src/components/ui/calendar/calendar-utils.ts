import type { DayStatus } from "./CalendarPicker";
import type { SlotSummary } from "./CalendarDayView";

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function buildCalendarCells(year: number, month: number): (number | null)[] {
  const totalDays = daysInMonth(year, month);
  const startDay = firstWeekday(year, month);
  const cells: (number | null)[] = [
    ...Array<null>(startDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function computeDayStatuses(
  slotsByDate: Record<string, SlotSummary[]>,
): Record<string, DayStatus> {
  const result: Record<string, DayStatus> = {};
  for (const [date, slots] of Object.entries(slotsByDate)) {
    if (slots.length === 0) continue;
    const allClosed = slots.every((s) => s.status === "closed");
    if (allClosed) { result[date] = "closed"; continue; }
    const allFullOrClosed = slots.every((s) => s.status === "full" || s.status === "closed");
    if (allFullOrClosed) { result[date] = "full"; continue; }
    const hasLimited = slots.some((s) => {
      const remaining = s.max_bookings - s.booking_count;
      return remaining <= 1 && s.status === "open";
    });
    result[date] = hasLimited ? "limited" : "available";
  }
  return result;
}

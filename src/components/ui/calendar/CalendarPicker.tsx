"use client";

import { useCallback, useState } from "react";
import {
  daysInMonth,
  firstWeekday,
  toDateString,
} from "./calendar-utils";

export type DayStatus = "available" | "limited" | "full" | "closed" | "none";

const STATUS_DOT: Record<DayStatus, string> = {
  available: "bg-green-400",
  limited: "bg-yellow-400",
  full: "bg-red-400",
  closed: "bg-slate-300",
  none: "",
};

export type CalendarPickerProps = {
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  dayStatuses?: Record<string, DayStatus>;
  initialMonth?: string;
};

function toYearMonth(iso: string): { year: number; month: number } {
  const [y, m] = iso.split("-").map(Number);
  return { year: y!, month: m! };
}

export function CalendarPicker({
  selectedDate,
  onDateSelect,
  dayStatuses = {},
  initialMonth,
}: CalendarPickerProps) {
  const today = new Date().toISOString().slice(0, 10);
  const startIso = initialMonth ?? selectedDate ?? today;
  const { year: initYear, month: initMonth } = toYearMonth(startIso);

  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);

  const prevMonth = useCallback(() => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else { setMonth((m) => m - 1); }
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else { setMonth((m) => m + 1); }
  }, [month]);

  const totalDays = daysInMonth(year, month);
  const startDay = firstWeekday(year, month);
  const cells: (number | null)[] = [
    ...Array<null>(startDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = `${year}年${month}月`;

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center justify-between pb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded p-1 text-sm text-muted hover:bg-slate-100"
          aria-label="前の月"
        >
          ‹
        </button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded p-1 text-sm text-muted hover:bg-slate-100"
          aria-label="次の月"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 border-t border-l border-border">
        {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
          <div
            key={d}
            className="border-r border-b border-border py-1 text-center text-xs font-medium text-muted"
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) {
            return (
              <div key={`empty-${i}`} className="border-r border-b border-border bg-slate-50" />
            );
          }
          const dateStr = toDateString(year, month, day);
          const status = dayStatuses[dateStr] ?? "none";
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onDateSelect?.(dateStr)}
              className={[
                "relative border-r border-b border-border py-2 text-center text-sm transition-colors",
                isSelected
                  ? "bg-primary text-white font-semibold"
                  : isToday
                    ? "bg-blue-50 font-semibold text-primary"
                    : "hover:bg-slate-50",
              ].join(" ")}
            >
              {day}
              {status !== "none" && (
                <span
                  className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${STATUS_DOT[status]}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" />受付中
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />残少
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />満席
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />クローズ
        </span>
      </div>
    </div>
  );
}

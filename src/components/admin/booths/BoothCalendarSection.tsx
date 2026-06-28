"use client";

import { useCallback, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarPicker, CalendarDayView } from "@/components/ui/calendar";
import { computeDayStatuses } from "@/components/ui/calendar/calendar-utils";
import type { SlotSummary } from "@/components/ui/calendar";

type Props = {
  businessId: string;
  boothId: string;
  slotsByDate: Record<string, SlotSummary[]>;
  initialDate?: string;
};

export function BoothCalendarSection({
  businessId,
  boothId,
  slotsByDate,
  initialDate,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate ?? today);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dayStatuses = computeDayStatuses(slotsByDate);
  const slotsForDate = slotsByDate[selectedDate] ?? [];

  const handleDateSelect = useCallback(
    (date: string) => {
      setSelectedDate(date);
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", date);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">カレンダー</h3>
        <CalendarPicker
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          dayStatuses={dayStatuses}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">枠一覧</h3>
          <a
            href={`/admin/booths/${boothId}/slots?businessId=${businessId}&date=${selectedDate}`}
            className="text-xs text-primary hover:underline"
          >
            枠を追加 →
          </a>
        </div>
        <div className="mt-3">
          <CalendarDayView date={selectedDate} slots={slotsForDate} />
        </div>
      </div>
    </div>
  );
}

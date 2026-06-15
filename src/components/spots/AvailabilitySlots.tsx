import { Card } from "@/components/ui/Card";
import { groupSlotsByDate } from "@/lib/slots/group-slots-by-date";
import { formatDate, formatTime } from "@/lib/utils/format";
import type { SlotDTO } from "@/types/api";

interface AvailabilitySlotsProps {
  /** API レスポンスの slots 配列（唯一のデータソース） */
  slots: SlotDTO[];
  planName?: string;
}

export function AvailabilitySlots({ slots, planName }: AvailabilitySlotsProps) {
  const slotsByDate = groupSlotsByDate(slots);
  const dates = Object.keys(slotsByDate).sort();

  if (dates.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-4xl" aria-hidden="true">
          📅
        </p>
        <p className="mt-3 font-medium text-foreground">
          {planName
            ? `「${planName}」で予約可能な空き枠がありません`
            : "現在、予約可能な空き枠がありません"}
        </p>
        <p className="mt-1 text-sm text-muted">別の日をお試しください</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => (
        <Card key={date} padding="sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {formatDate(date)}
          </h3>
          <ul className="space-y-2">
            {slotsByDate[date]!.map((slot) => (
              <li
                key={slot.id}
                className="flex items-center justify-between rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-sm"
              >
                <span className="font-medium text-foreground">
                  {formatTime(slot.start_time)} 〜 {formatTime(slot.end_time)}
                </span>
                {/* remaining_count: API 値をそのまま表示 */}
                <span
                  className={
                    slot.remaining_count <= 2
                      ? "font-semibold text-orange-600"
                      : "text-muted"
                  }
                >
                  残り {slot.remaining_count} 名
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

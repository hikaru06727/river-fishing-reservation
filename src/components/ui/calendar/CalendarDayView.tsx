export type SlotItemStatus = "open" | "closed" | "full";

export type SlotSummary = {
  id: string;
  start_time: string;
  end_time: string;
  max_bookings: number;
  booking_count: number;
  status: SlotItemStatus;
};

const STATUS_LABEL: Record<SlotItemStatus, string> = {
  open: "受付中",
  full: "満席",
  closed: "クローズ",
};

const STATUS_STYLE: Record<SlotItemStatus, string> = {
  open: "border-green-200 bg-green-50 text-green-800",
  full: "border-red-200 bg-red-50 text-red-800",
  closed: "border-slate-200 bg-slate-50 text-slate-500",
};

export type CalendarDayViewProps = {
  date: string;
  slots: SlotSummary[];
  onSlotClick?: (slot: SlotSummary) => void;
  actionSlot?: React.ReactNode;
};

export function CalendarDayView({
  date,
  slots,
  onSlotClick,
  actionSlot,
}: CalendarDayViewProps) {
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{dateLabel}</p>
        {actionSlot}
      </div>

      {slots.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          この日の枠はありません
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {slots.map((slot) => {
            const remaining = slot.max_bookings - slot.booking_count;
            return (
              <li key={slot.id}>
                <button
                  type="button"
                  onClick={() => onSlotClick?.(slot)}
                  disabled={!onSlotClick}
                  className={[
                    "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                    STATUS_STYLE[slot.status],
                    onSlotClick ? "hover:opacity-80 cursor-pointer" : "cursor-default",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                    </span>
                    <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
                      {STATUS_LABEL[slot.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs opacity-75">
                    予約 {slot.booking_count} / {slot.max_bookings}（残 {remaining}）
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

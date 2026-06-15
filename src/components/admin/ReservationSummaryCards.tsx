import { Card } from "@/components/ui/Card";
import { formatDate, formatYen } from "@/lib/utils/format";
import type { TodayReservationSummary } from "@/lib/reservations/get-admin-reservations";
import { toISODate } from "@/lib/utils/date";

interface ReservationSummaryCardsProps {
  summary: TodayReservationSummary;
}

export function ReservationSummaryCards({ summary }: ReservationSummaryCardsProps) {
  const todayLabel = formatDate(toISODate(new Date()));

  const cards = [
    {
      label: "本日の予約件数",
      value: `${summary.totalReservations} 件`,
      sub: todayLabel,
    },
    {
      label: "本日の合計人数",
      value: `${summary.totalGuests} 名`,
      sub: "pending / confirmed",
    },
    {
      label: "本日の見込み売上",
      value: formatYen(summary.expectedRevenue),
      sub: "pending / confirmed",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <p className="text-sm text-muted">{card.label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{card.value}</p>
          <p className="mt-1 text-xs text-muted">{card.sub}</p>
        </Card>
      ))}
    </div>
  );
}

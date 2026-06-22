import { formatYen } from "@/lib/utils/format";
import type { SalesReport } from "@/lib/sales/sales-types";

interface SalesSummaryCardsProps {
  report: SalesReport;
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export function SalesSummaryCards({ report }: SalesSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label="確定売上"
        value={formatYen(report.confirmedRevenueYen)}
        sub="決済完了・現金受領済み"
      />
      <SummaryCard
        label="売上見込み"
        value={formatYen(report.projectedRevenueYen)}
        sub="確定予約ベース"
      />
      <SummaryCard label="予約件数" value={`${report.reservationCount} 件`} />
      <SummaryCard label="キャンセル件数" value={`${report.cancelledCount} 件`} />
    </div>
  );
}

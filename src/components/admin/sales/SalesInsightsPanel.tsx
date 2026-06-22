import { formatDate, formatYen } from "@/lib/utils/format";
import { computeSalesInsights } from "@/lib/sales/sales-insights";
import type { SalesReport } from "@/lib/sales/sales-types";

interface SalesInsightsPanelProps {
  report: SalesReport;
}

export function SalesInsightsPanel({ report }: SalesInsightsPanelProps) {
  const insights = computeSalesInsights(report);

  const items = [
    {
      label: "平均日次売上（確定）",
      value: formatYen(insights.averageDailyConfirmedRevenueYen),
    },
    {
      label: "予約1件あたり平均売上（見込み）",
      value: formatYen(insights.averageRevenuePerReservationYen),
    },
    {
      label: "最も売上が高い日（確定）",
      value: insights.topDayByConfirmedRevenue
        ? `${formatDate(insights.topDayByConfirmedRevenue.date)}（${formatYen(insights.topDayByConfirmedRevenue.amountYen)}）`
        : "—",
    },
    {
      label: "最も売上が高いプラン（見込み）",
      value: insights.topPlanByProjectedRevenue
        ? `${insights.topPlanByProjectedRevenue.planName}（${formatYen(insights.topPlanByProjectedRevenue.amountYen)}）`
        : "—",
    },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">売上サマリー（補助）</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted">{item.label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

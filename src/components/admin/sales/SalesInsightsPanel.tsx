import { formatDate, formatYen } from "@/lib/utils/format";
import type { SalesInsights } from "@/lib/sales/sales-insights";

interface SalesInsightsPanelProps {
  insights: SalesInsights;
}

export function SalesInsightsPanel({ insights }: SalesInsightsPanelProps) {
  const averageBusinessDayValue =
    insights.averageBusinessDayConfirmedRevenueYen != null
      ? formatYen(insights.averageBusinessDayConfirmedRevenueYen)
      : "—";

  const items = [
    {
      label: "平均営業日売上（確定）",
      value: averageBusinessDayValue,
      note:
        insights.businessDayCount > 0
          ? `営業日・休業日設定をもとに算出（期間内営業日 ${insights.businessDayCount} 日）`
          : "営業日・休業日設定をもとに算出（期間内の営業日なし）",
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
            {item.note ? <p className="mt-0.5 text-xs text-muted">{item.note}</p> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

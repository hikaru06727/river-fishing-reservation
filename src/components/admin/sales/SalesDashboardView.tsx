import { formatDate } from "@/lib/utils/format";
import {
  SalesBusinessTable,
  SalesDailyTable,
  SalesPlanTable,
} from "@/components/admin/sales/SalesBreakdownTables";
import { SalesInsightsPanel } from "@/components/admin/sales/SalesInsightsPanel";
import { SalesPaymentMethodBreakdown } from "@/components/admin/sales/SalesPaymentMethodBreakdown";
import { SalesPeriodFilters } from "@/components/admin/sales/SalesPeriodFilters";
import { SalesSummaryCards } from "@/components/admin/sales/SalesSummaryCards";
import type { SalesReport } from "@/lib/sales/sales-types";

interface SalesDashboardViewProps {
  report: SalesReport;
  isAdmin: boolean;
  scopedBusinessNames: string[] | null;
}

export function SalesDashboardView({
  report,
  isAdmin,
  scopedBusinessNames,
}: SalesDashboardViewProps) {
  const periodLabel =
    report.dateFrom === report.dateTo
      ? formatDate(report.dateFrom)
      : `${formatDate(report.dateFrom)} 〜 ${formatDate(report.dateTo)}`;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">売上ダッシュボード</h2>
        <p className="text-sm text-muted">集計期間: {periodLabel}</p>
        {!isAdmin ? (
          <p className="text-sm text-amber-800">
            担当事業の売上のみ表示・CSV出力しています
            {scopedBusinessNames && scopedBusinessNames.length > 0
              ? `（${scopedBusinessNames.join("、")}）`
              : ""}
            。
          </p>
        ) : null}
        <p className="text-xs text-muted">
          確定売上は決済完了（オンライン）または現金受領済みの金額です。売上見込みは確定予約のみを集計し、キャンセル・期限切れ・未確定（pending）予約は含みません。予約件数は確定・仮予約の合計です。CSV
          は画面と同じ期間・権限スコープで出力されます。
        </p>
      </header>

      <SalesPeriodFilters dateFrom={report.dateFrom} dateTo={report.dateTo} />

      <SalesSummaryCards report={report} />

      <SalesInsightsPanel report={report} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <SalesPaymentMethodBreakdown
            breakdown={report.paymentMethodBreakdown}
            dateFrom={report.dateFrom}
            dateTo={report.dateTo}
          />
        </div>
        <div className="space-y-6 xl:col-span-2">
          <SalesDailyTable
            rows={report.dailyBreakdown}
            dateFrom={report.dateFrom}
            dateTo={report.dateTo}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SalesBusinessTable
          rows={report.businessBreakdown}
          dateFrom={report.dateFrom}
          dateTo={report.dateTo}
        />
        <SalesPlanTable
          rows={report.planBreakdown}
          dateFrom={report.dateFrom}
          dateTo={report.dateTo}
        />
      </div>
    </div>
  );
}

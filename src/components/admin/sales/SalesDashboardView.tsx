"use client";

import { useState } from "react";
import { formatDate, formatYen } from "@/lib/utils/format";
import {
  SalesBusinessTable,
  SalesDailyTable,
  SalesPlanTable,
} from "@/components/admin/sales/SalesBreakdownTables";
import { SalesInsightsPanel } from "@/components/admin/sales/SalesInsightsPanel";
import { SalesPaymentMethodBreakdown } from "@/components/admin/sales/SalesPaymentMethodBreakdown";
import { SalesPeriodFilters } from "@/components/admin/sales/SalesPeriodFilters";
import { SalesSummaryCards } from "@/components/admin/sales/SalesSummaryCards";
import { TodaySalesSummaryCard } from "@/components/admin/sales/TodaySalesSummaryCard";
import type { SalesInsights } from "@/lib/sales/sales-insights";
import type { SalesReport, TodaySalesSummary } from "@/lib/sales/sales-types";

type Tab = "overview" | "reservations" | "products" | "insights";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "全体" },
  { id: "reservations", label: "予約" },
  { id: "products", label: "物販" },
  { id: "insights", label: "分析" },
];

interface SalesDashboardViewProps {
  report: SalesReport;
  insights: SalesInsights;
  isAdmin: boolean;
  scopedBusinessNames: string[] | null;
  productSalesYen: number;
  todaySummary: TodaySalesSummary;
}

export function SalesDashboardView({
  report,
  insights,
  isAdmin,
  scopedBusinessNames,
  productSalesYen,
  todaySummary,
}: SalesDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const periodLabel =
    report.dateFrom === report.dateTo
      ? formatDate(report.dateFrom)
      : `${formatDate(report.dateFrom)} 〜 ${formatDate(report.dateTo)}`;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">売上ダッシュボード</h2>
        <p className="text-sm text-muted">集計期間: {periodLabel}</p>
        {!isAdmin && (
          <p className="text-sm text-amber-800">
            担当事業の売上のみ表示・CSV出力しています
            {scopedBusinessNames && scopedBusinessNames.length > 0
              ? `（${scopedBusinessNames.join("、")}）`
              : ""}
            。
          </p>
        )}
        <p className="text-xs text-muted">
          確定売上は決済完了（オンライン）または現金受領済みの金額です。売上見込みは確定予約のみを集計し、キャンセル・期限切れ・未確定（pending）予約は含みません。予約件数は確定・仮予約の合計です。CSV
          は画面と同じ期間・権限スコープで出力されます。
        </p>
      </header>

      {/* タブナビゲーション */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "-mb-px border-b-2 border-primary text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 全体タブ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <SalesPeriodFilters dateFrom={report.dateFrom} dateTo={report.dateTo} />
          <TodaySalesSummaryCard summary={todaySummary} />
        </div>
      )}

      {/* 予約タブ */}
      {activeTab === "reservations" && (
        <div className="space-y-6">
          <SalesSummaryCards report={report} />
          <SalesDailyTable
            rows={report.dailyBreakdown}
            dateFrom={report.dateFrom}
            dateTo={report.dateTo}
          />
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
      )}

      {/* 物販タブ */}
      {activeTab === "products" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted">POS 販売合計（税込み）</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{formatYen(productSalesYen)}</p>
            <p className="mt-1 text-xs text-muted">レジ販売セッションの合計金額（税込）。予約売上・手動売上とは別集計です。</p>
          </div>
          <SalesPaymentMethodBreakdown
            breakdown={report.paymentMethodBreakdown}
            dateFrom={report.dateFrom}
            dateTo={report.dateTo}
          />
          <SalesInsightsPanel insights={insights} />
        </div>
      )}

      {/* 分析タブ */}
      {activeTab === "insights" && (
        <div className="space-y-6">
          <SalesInsightsPanel insights={insights} />
        </div>
      )}
    </div>
  );
}

import { formatDate, formatYen } from "@/lib/utils/format";
import type { TodaySalesSummary } from "@/lib/sales/sales-types";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "現金",
  card: "クレジットカード",
  eMoney: "電子マネー",
  qr: "QRコード決済",
  other: "その他",
};

interface TodaySalesSummaryCardProps {
  summary: TodaySalesSummary;
}

export function TodaySalesSummaryCard({ summary }: TodaySalesSummaryCardProps) {
  const methodEntries = (Object.entries(summary.byPaymentMethod) as [string, number][]).filter(
    ([, amount]) => amount > 0,
  );

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">本日の売上サマリー</h3>
        <span className="text-xs text-muted">{formatDate(summary.date)}</span>
      </div>

      {/* 上段: 合計・件数 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-muted">税込売上合計</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatYen(summary.totalAmountYen)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-muted">取引件数</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {summary.transactionCount.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-muted">件</span>
          </p>
        </div>
      </div>

      {/* 下段: 支払方法別内訳 */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted">支払方法別内訳</p>
        {summary.totalAmountYen === 0 ? (
          <p className="text-sm text-muted">本日の売上データはありません。</p>
        ) : (
          <div className="space-y-1.5">
            {methodEntries.length === 0 ? (
              <p className="text-sm text-muted">内訳なし</p>
            ) : (
              methodEntries.map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between text-sm">
                  <span className="text-muted">
                    {PAYMENT_METHOD_LABELS[method] ?? method}
                  </span>
                  <span className="font-medium text-foreground">{formatYen(amount)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

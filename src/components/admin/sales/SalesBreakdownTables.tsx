import { formatDate, formatYen } from "@/lib/utils/format";
import { SalesCsvExportLink } from "@/components/admin/sales/SalesCsvExportLink";
import type {
  BusinessSalesRow,
  DailySalesRow,
  PlanSalesRow,
} from "@/lib/sales/sales-types";

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-muted">
        {message}
      </td>
    </tr>
  );
}

function SalesTable({
  title,
  headers,
  csvType,
  csvLabel,
  dateFrom,
  dateTo,
  children,
}: {
  title: string;
  headers: string[];
  csvType?: "daily" | "business" | "plan";
  csvLabel?: string;
  dateFrom: string;
  dateTo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {csvType && csvLabel ? (
          <SalesCsvExportLink
            type={csvType}
            label={csvLabel}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-muted">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
    </section>
  );
}

type TableProps<T> = {
  rows: T[];
  dateFrom: string;
  dateTo: string;
};

export function SalesDailyTable({ rows, dateFrom, dateTo }: TableProps<DailySalesRow>) {
  return (
    <SalesTable
      title="日別売上"
      headers={["日付", "確定売上", "売上見込み", "予約件数", "キャンセル件数"]}
      csvType="daily"
      csvLabel="日別CSV"
      dateFrom={dateFrom}
      dateTo={dateTo}
    >
      {rows.length === 0 ? (
        <EmptyRow colSpan={5} message="期間内のデータはありません" />
      ) : (
        rows.map((row) => (
          <tr key={row.date}>
            <td className="px-4 py-3">{formatDate(row.date)}</td>
            <td className="px-4 py-3">{formatYen(row.confirmedRevenueYen)}</td>
            <td className="px-4 py-3">{formatYen(row.projectedRevenueYen)}</td>
            <td className="px-4 py-3">{row.reservationCount} 件</td>
            <td className="px-4 py-3">{row.cancelledCount} 件</td>
          </tr>
        ))
      )}
    </SalesTable>
  );
}

export function SalesBusinessTable({
  rows,
  dateFrom,
  dateTo,
}: TableProps<BusinessSalesRow>) {
  return (
    <SalesTable
      title="事業者別売上"
      headers={["事業者", "確定売上", "売上見込み", "予約件数", "キャンセル件数"]}
      csvType="business"
      csvLabel="事業者別CSV"
      dateFrom={dateFrom}
      dateTo={dateTo}
    >
      {rows.length === 0 ? (
        <EmptyRow colSpan={5} message="期間内のデータはありません" />
      ) : (
        rows.map((row) => (
          <tr key={row.businessId}>
            <td className="px-4 py-3">{row.businessName}</td>
            <td className="px-4 py-3">{formatYen(row.confirmedRevenueYen)}</td>
            <td className="px-4 py-3">{formatYen(row.projectedRevenueYen)}</td>
            <td className="px-4 py-3">{row.reservationCount} 件</td>
            <td className="px-4 py-3">{row.cancelledCount} 件</td>
          </tr>
        ))
      )}
    </SalesTable>
  );
}

export function SalesPlanTable({ rows, dateFrom, dateTo }: TableProps<PlanSalesRow>) {
  return (
    <SalesTable
      title="プラン別売上"
      headers={["プラン", "確定売上", "売上見込み", "予約件数", "キャンセル件数"]}
      csvType="plan"
      csvLabel="プラン別CSV"
      dateFrom={dateFrom}
      dateTo={dateTo}
    >
      {rows.length === 0 ? (
        <EmptyRow colSpan={5} message="期間内のデータはありません" />
      ) : (
        rows.map((row) => (
          <tr key={row.planName}>
            <td className="px-4 py-3">{row.planName}</td>
            <td className="px-4 py-3">{formatYen(row.confirmedRevenueYen)}</td>
            <td className="px-4 py-3">{formatYen(row.projectedRevenueYen)}</td>
            <td className="px-4 py-3">{row.reservationCount} 件</td>
            <td className="px-4 py-3">{row.cancelledCount} 件</td>
          </tr>
        ))
      )}
    </SalesTable>
  );
}

import { formatYen } from "@/lib/utils/format";
import { SalesCsvExportLink } from "@/components/admin/sales/SalesCsvExportLink";
import type { PaymentMethodSalesBreakdown } from "@/lib/sales/sales-types";

interface SalesPaymentMethodBreakdownProps {
  breakdown: PaymentMethodSalesBreakdown;
  dateFrom: string;
  dateTo: string;
}

export function SalesPaymentMethodBreakdown({
  breakdown,
  dateFrom,
  dateTo,
}: SalesPaymentMethodBreakdownProps) {
  const rows = [
    { label: "オンライン決済（online）", amount: breakdown.online },
    { label: "現地現金（cash_at_venue）", amount: breakdown.cash_at_venue },
  ];

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">支払い方法別売上（確定）</h3>
        <SalesCsvExportLink
          type="paymentMethod"
          label="支払い方法別CSV"
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="text-muted">{row.label}</span>
            <span className="font-medium text-foreground">{formatYen(row.amount)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";
import type { SalesCsvType } from "@/lib/sales/sales-csv";
import { buildSalesCsvExportUrl } from "@/lib/sales/sales-csv";

interface SalesCsvExportLinkProps {
  type: SalesCsvType;
  label: string;
  dateFrom: string;
  dateTo: string;
}

export function SalesCsvExportLink({
  type,
  label,
  dateFrom,
  dateTo,
}: SalesCsvExportLinkProps) {
  return (
    <Link
      href={buildSalesCsvExportUrl(type, dateFrom, dateTo)}
      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-slate-50"
      download
    >
      {label}
    </Link>
  );
}

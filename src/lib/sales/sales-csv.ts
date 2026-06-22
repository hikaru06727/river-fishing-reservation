import type { SalesReport } from "@/lib/sales/sales-types";

export const SALES_CSV_TYPES = ["daily", "business", "plan", "paymentMethod"] as const;
export type SalesCsvType = (typeof SALES_CSV_TYPES)[number];

export const UTF8_BOM = "\uFEFF";

export function parseSalesCsvType(value: string | null | undefined): SalesCsvType | null {
  if (!value) {
    return null;
  }
  return SALES_CSV_TYPES.includes(value as SalesCsvType) ? (value as SalesCsvType) : null;
}

/** RFC 4180 相当の CSV フィールドエスケープ */
export function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvContent(headers: string[], rows: Array<Array<string | number>>): string {
  const lines = [
    headers.map(escapeCsvField).join(","),
    ...rows.map((row) => row.map(escapeCsvField).join(",")),
  ];
  return UTF8_BOM + lines.join("\r\n");
}

export function buildSalesCsvFilename(
  type: SalesCsvType,
  dateFrom: string,
  dateTo: string,
): string {
  return `sales-${type}-${dateFrom}_${dateTo}.csv`;
}

export function buildDailySalesCsv(report: SalesReport): string {
  return buildCsvContent(
    ["日付", "確定売上", "売上見込み", "予約件数", "キャンセル件数"],
    report.dailyBreakdown.map((row) => [
      row.date,
      row.confirmedRevenueYen,
      row.projectedRevenueYen,
      row.reservationCount,
      row.cancelledCount,
    ]),
  );
}

export function buildBusinessSalesCsv(report: SalesReport): string {
  return buildCsvContent(
    ["事業者名", "確定売上", "売上見込み", "予約件数", "キャンセル件数"],
    report.businessBreakdown.map((row) => [
      row.businessName,
      row.confirmedRevenueYen,
      row.projectedRevenueYen,
      row.reservationCount,
      row.cancelledCount,
    ]),
  );
}

export function buildPlanSalesCsv(report: SalesReport): string {
  return buildCsvContent(
    ["プラン名", "確定売上", "売上見込み", "予約件数", "キャンセル件数"],
    report.planBreakdown.map((row) => [
      row.planName,
      row.confirmedRevenueYen,
      row.projectedRevenueYen,
      row.reservationCount,
      row.cancelledCount,
    ]),
  );
}

export function buildPaymentMethodSalesCsv(report: SalesReport): string {
  return buildCsvContent(
    ["支払い方法", "確定売上", "売上見込み", "予約件数"],
    report.paymentMethodDetailBreakdown.map((row) => [
      row.label,
      row.confirmedRevenueYen,
      row.projectedRevenueYen,
      row.reservationCount,
    ]),
  );
}

export function buildSalesCsvByType(type: SalesCsvType, report: SalesReport): string {
  switch (type) {
    case "daily":
      return buildDailySalesCsv(report);
    case "business":
      return buildBusinessSalesCsv(report);
    case "plan":
      return buildPlanSalesCsv(report);
    case "paymentMethod":
      return buildPaymentMethodSalesCsv(report);
  }
}

export function buildSalesCsvExportUrl(
  type: SalesCsvType,
  dateFrom: string,
  dateTo: string,
): string {
  const params = new URLSearchParams({
    type,
    dateFrom,
    dateTo,
  });
  return `/admin/sales/export?${params.toString()}`;
}

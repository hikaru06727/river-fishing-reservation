import type { TodaySalesByPaymentMethod, TodaySalesRawRow, TodaySalesSummary } from "./sales-types";

export function categorizePaymentMethod(method: string | null): keyof TodaySalesByPaymentMethod {
  if (!method) return "other";
  switch (method) {
    case "cash":
    case "cash_at_venue":
      return "cash";
    case "online":
    case "stripe":
    case "card":
    case "credit_card":
      return "card";
    case "e_money":
      return "eMoney";
    case "qr":
      return "qr";
    default:
      return "other";
  }
}

export function aggregateTodaySummary(rows: TodaySalesRawRow[], date: string): TodaySalesSummary {
  const byPaymentMethod: TodaySalesByPaymentMethod = {
    cash: 0,
    card: 0,
    eMoney: 0,
    qr: 0,
    other: 0,
  };

  let totalAmountYen = 0;

  for (const row of rows) {
    const amount = Math.max(0, row.amountYen);
    totalAmountYen += amount;
    const cat = categorizePaymentMethod(row.paymentMethod);
    byPaymentMethod[cat] += amount;
  }

  return {
    date,
    totalAmountYen,
    transactionCount: rows.length,
    byPaymentMethod,
  };
}

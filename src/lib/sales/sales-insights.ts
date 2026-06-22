import type { SalesReport } from "@/lib/sales/sales-types";

export type SalesInsights = {
  averageDailyConfirmedRevenueYen: number;
  averageRevenuePerReservationYen: number;
  topDayByConfirmedRevenue: { date: string; amountYen: number } | null;
  topPlanByProjectedRevenue: { planName: string; amountYen: number } | null;
};

function countDaysInRange(dateFrom: string, dateTo: string): number {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1);
}

export function computeSalesInsights(report: SalesReport): SalesInsights {
  const dayCount = countDaysInRange(report.dateFrom, report.dateTo);
  const averageDailyConfirmedRevenueYen = Math.round(report.confirmedRevenueYen / dayCount);
  const averageRevenuePerReservationYen =
    report.reservationCount > 0
      ? Math.round(report.projectedRevenueYen / report.reservationCount)
      : 0;

  const topDay = report.dailyBreakdown.reduce<{ date: string; amountYen: number } | null>(
    (best, row) => {
      if (!best || row.confirmedRevenueYen > best.amountYen) {
        return { date: row.date, amountYen: row.confirmedRevenueYen };
      }
      return best;
    },
    null,
  );

  const topPlan = report.planBreakdown.reduce<{ planName: string; amountYen: number } | null>(
    (best, row) => {
      if (!best || row.projectedRevenueYen > best.amountYen) {
        return { planName: row.planName, amountYen: row.projectedRevenueYen };
      }
      return best;
    },
    null,
  );

  return {
    averageDailyConfirmedRevenueYen,
    averageRevenuePerReservationYen,
    topDayByConfirmedRevenue: topDay && topDay.amountYen > 0 ? topDay : null,
    topPlanByProjectedRevenue: topPlan && topPlan.amountYen > 0 ? topPlan : null,
  };
}

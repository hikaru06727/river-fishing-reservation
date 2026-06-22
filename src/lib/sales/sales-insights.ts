import type { SalesReport } from "@/lib/sales/sales-types";

export type SalesInsights = {
  /** 営業日数が 0 のとき null（表示は —） */
  averageBusinessDayConfirmedRevenueYen: number | null;
  businessDayCount: number;
  averageRevenuePerReservationYen: number;
  topDayByConfirmedRevenue: { date: string; amountYen: number } | null;
  topPlanByProjectedRevenue: { planName: string; amountYen: number } | null;
};

export function computeSalesInsights(
  report: SalesReport,
  businessDayCount: number,
): SalesInsights {
  const averageBusinessDayConfirmedRevenueYen =
    businessDayCount > 0 ? Math.round(report.confirmedRevenueYen / businessDayCount) : null;
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
    averageBusinessDayConfirmedRevenueYen,
    businessDayCount,
    averageRevenuePerReservationYen,
    topDayByConfirmedRevenue: topDay && topDay.amountYen > 0 ? topDay : null,
    topPlanByProjectedRevenue: topPlan && topPlan.amountYen > 0 ? topPlan : null,
  };
}

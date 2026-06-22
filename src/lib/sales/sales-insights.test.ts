import { describe, expect, it } from "vitest";
import { countCalendarDaysInRange } from "@/lib/sales/sales-business-days";
import { computeSalesInsights } from "@/lib/sales/sales-insights";
import type { SalesReport } from "@/lib/sales/sales-types";

const baseReport = (overrides: Partial<SalesReport> = {}): SalesReport => ({
  dateFrom: "2026-06-01",
  dateTo: "2026-06-03",
  confirmedRevenueYen: 3000,
  projectedRevenueYen: 6000,
  reservationCount: 3,
  cancelledCount: 0,
  paymentMethodBreakdown: { online: 3000, cash_at_venue: 0 },
  paymentMethodDetailBreakdown: [],
  dailyBreakdown: [
    {
      date: "2026-06-01",
      confirmedRevenueYen: 1000,
      projectedRevenueYen: 2000,
      reservationCount: 1,
      cancelledCount: 0,
    },
    {
      date: "2026-06-02",
      confirmedRevenueYen: 2000,
      projectedRevenueYen: 4000,
      reservationCount: 2,
      cancelledCount: 0,
    },
  ],
  businessBreakdown: [],
  planBreakdown: [
    {
      planName: "半日",
      confirmedRevenueYen: 2000,
      projectedRevenueYen: 5000,
      reservationCount: 2,
      cancelledCount: 0,
    },
    {
      planName: "終日",
      confirmedRevenueYen: 1000,
      projectedRevenueYen: 1000,
      reservationCount: 1,
      cancelledCount: 0,
    },
  ],
  ...overrides,
});

describe("computeSalesInsights", () => {
  it("営業日数を母数に平均営業日売上を計算する", () => {
    const report = baseReport();
    const insights = computeSalesInsights(report, 2);

    expect(insights.businessDayCount).toBe(2);
    expect(insights.averageBusinessDayConfirmedRevenueYen).toBe(1500);
  });

  it("全日数平均より営業日平均のほうが高くなる", () => {
    const report = baseReport({ confirmedRevenueYen: 3000 });
    const calendarDays = countCalendarDaysInRange(report.dateFrom, report.dateTo);
    const calendarAverage = Math.round(report.confirmedRevenueYen / calendarDays);
    const insights = computeSalesInsights(report, 2);

    expect(calendarAverage).toBe(1000);
    expect(insights.averageBusinessDayConfirmedRevenueYen).toBe(1500);
    expect(insights.averageBusinessDayConfirmedRevenueYen!).toBeGreaterThan(calendarAverage);
  });

  it("営業日数が 0 の場合は null を返す", () => {
    const insights = computeSalesInsights(baseReport(), 0);

    expect(insights.businessDayCount).toBe(0);
    expect(insights.averageBusinessDayConfirmedRevenueYen).toBeNull();
  });

  it("予約単価とトップ日・プランを返す", () => {
    const insights = computeSalesInsights(baseReport(), 2);

    expect(insights.averageRevenuePerReservationYen).toBe(2000);
    expect(insights.topDayByConfirmedRevenue).toEqual({
      date: "2026-06-02",
      amountYen: 2000,
    });
    expect(insights.topPlanByProjectedRevenue).toEqual({
      planName: "半日",
      amountYen: 5000,
    });
  });

  it("データなしでも崩れない", () => {
    const insights = computeSalesInsights(
      baseReport({
        confirmedRevenueYen: 0,
        projectedRevenueYen: 0,
        reservationCount: 0,
        dailyBreakdown: [],
        planBreakdown: [],
      }),
      0,
    );

    expect(insights.topDayByConfirmedRevenue).toBeNull();
    expect(insights.topPlanByProjectedRevenue).toBeNull();
    expect(insights.averageRevenuePerReservationYen).toBe(0);
    expect(insights.averageBusinessDayConfirmedRevenueYen).toBeNull();
  });
});

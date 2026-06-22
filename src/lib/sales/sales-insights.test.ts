import { describe, expect, it } from "vitest";
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
  it("平均日次売上と予約単価を計算する", () => {
    const insights = computeSalesInsights(baseReport());

    expect(insights.averageDailyConfirmedRevenueYen).toBe(1000);
    expect(insights.averageRevenuePerReservationYen).toBe(2000);
  });

  it("最も売上が高い日とプランを返す", () => {
    const insights = computeSalesInsights(baseReport());

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
    );

    expect(insights.topDayByConfirmedRevenue).toBeNull();
    expect(insights.topPlanByProjectedRevenue).toBeNull();
    expect(insights.averageRevenuePerReservationYen).toBe(0);
  });
});

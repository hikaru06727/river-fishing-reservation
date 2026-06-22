import { describe, expect, it } from "vitest";
import { filterSalesRowsForProfile } from "@/lib/sales/sales-access";
import {
  aggregateSalesReport,
  filterRowsByDateRange,
  isConfirmedRevenue,
  isProjectedRevenue,
  resolvePlanDisplayName,
  resolveReservationAmountYen,
} from "@/lib/sales/sales-aggregation";
import type { SalesReservationRow } from "@/lib/sales/sales-types";

const bizA = "11111111-1111-4111-8111-111111111111";
const bizB = "22222222-2222-4222-8222-222222222222";

function makeRow(
  overrides: Partial<SalesReservationRow> & Pick<SalesReservationRow, "id" | "reservation_date" | "status">,
): SalesReservationRow {
  return {
    payment_method: "online",
    guest_count: 2,
    total_amount_yen: 10000,
    reserved_plan_name: "半日プラン",
    reserved_unit_price_yen: 5000,
    business_id: bizA,
    business_name: "事業A",
    payments: null,
    ...overrides,
  };
}

describe("resolveReservationAmountYen", () => {
  it("reserved_unit_price_yen × guest_count を優先する", () => {
    const row = makeRow({
      id: "r1",
      reservation_date: "2026-06-01",
      status: "confirmed",
      reserved_unit_price_yen: 4500,
      guest_count: 3,
      total_amount_yen: 9999,
    });
    expect(resolveReservationAmountYen(row)).toBe(13500);
  });

  it("スナップショットがなければ total_amount_yen を使う", () => {
    const row = makeRow({
      id: "r2",
      reservation_date: "2026-06-01",
      status: "confirmed",
      reserved_unit_price_yen: null,
      total_amount_yen: 8000,
    });
    expect(resolveReservationAmountYen(row)).toBe(8000);
  });
});

describe("aggregateSalesReport", () => {
  const range = { dateFrom: "2026-06-01", dateTo: "2026-06-30" };

  it("確定売上と売上見込みを分けて計算する", () => {
    const rows = [
      makeRow({
        id: "paid",
        reservation_date: "2026-06-10",
        status: "confirmed",
        payment_method: "online",
        payments: { status: "succeeded", amount_yen: 10000 },
      }),
      makeRow({
        id: "unpaid-cash",
        reservation_date: "2026-06-11",
        status: "confirmed",
        payment_method: "cash_at_venue",
        payments: { status: "pending", amount_yen: 10000 },
      }),
    ];

    const report = aggregateSalesReport(rows, range);

    expect(report.confirmedRevenueYen).toBe(10000);
    expect(report.projectedRevenueYen).toBe(20000);
  });

  it("cancelled / expired / pending は売上見込みから除外される", () => {
    const rows = [
      makeRow({
        id: "confirmed",
        reservation_date: "2026-06-05",
        status: "confirmed",
        total_amount_yen: 5000,
        reserved_unit_price_yen: 2500,
        guest_count: 2,
      }),
      makeRow({
        id: "pending",
        reservation_date: "2026-06-06",
        status: "pending",
        total_amount_yen: 3000,
      }),
      makeRow({
        id: "cancelled",
        reservation_date: "2026-06-07",
        status: "cancelled",
        total_amount_yen: 4000,
      }),
      makeRow({
        id: "expired",
        reservation_date: "2026-06-08",
        status: "expired",
        total_amount_yen: 6000,
      }),
    ];

    const report = aggregateSalesReport(rows, range);

    expect(report.projectedRevenueYen).toBe(5000);
    expect(report.cancelledCount).toBe(1);
    expect(report.reservationCount).toBe(2);
  });

  it("payment_method ごとの確定売上を集計する", () => {
    const rows = [
      makeRow({
        id: "online",
        reservation_date: "2026-06-10",
        status: "confirmed",
        payment_method: "online",
        payments: { status: "succeeded", amount_yen: 7000 },
      }),
      makeRow({
        id: "cash",
        reservation_date: "2026-06-11",
        status: "confirmed",
        payment_method: "cash_at_venue",
        payments: { status: "succeeded", amount_yen: 3000 },
      }),
    ];

    const report = aggregateSalesReport(rows, range);

    expect(report.paymentMethodBreakdown.online).toBe(7000);
    expect(report.paymentMethodBreakdown.cash_at_venue).toBe(3000);
  });

  it("reserved_plan_name でプラン別集計する", () => {
    const rows = [
      makeRow({
        id: "p1",
        reservation_date: "2026-06-10",
        status: "confirmed",
        reserved_plan_name: "朝プラン",
        reserved_unit_price_yen: 4000,
        guest_count: 1,
      }),
      makeRow({
        id: "p2",
        reservation_date: "2026-06-11",
        status: "confirmed",
        reserved_plan_name: "夕プラン",
        reserved_unit_price_yen: 6000,
        guest_count: 1,
      }),
    ];

    const report = aggregateSalesReport(rows, range);
    const planNames = report.planBreakdown.map((row) => row.planName);

    expect(planNames).toContain("朝プラン");
    expect(planNames).toContain("夕プラン");
    expect(report.planBreakdown.find((p) => p.planName === "朝プラン")?.projectedRevenueYen).toBe(
      4000,
    );
  });

  it("期間外の予約は除外される", () => {
    const rows = [
      makeRow({
        id: "in",
        reservation_date: "2026-06-15",
        status: "confirmed",
        total_amount_yen: 5000,
        reserved_unit_price_yen: null,
      }),
      makeRow({
        id: "out",
        reservation_date: "2026-07-01",
        status: "confirmed",
        total_amount_yen: 9000,
        reserved_unit_price_yen: null,
      }),
    ];

    const report = aggregateSalesReport(rows, range);

    expect(report.projectedRevenueYen).toBe(5000);
    expect(report.dailyBreakdown).toHaveLength(1);
    expect(report.dailyBreakdown[0]?.date).toBe("2026-06-15");
  });

  it("日別・事業者別の内訳を返す", () => {
    const rows = [
      makeRow({
        id: "a1",
        reservation_date: "2026-06-10",
        status: "confirmed",
        business_id: bizA,
        business_name: "事業A",
        payments: { status: "succeeded", amount_yen: 5000 },
      }),
      makeRow({
        id: "b1",
        reservation_date: "2026-06-10",
        status: "confirmed",
        business_id: bizB,
        business_name: "事業B",
        total_amount_yen: 8000,
        reserved_unit_price_yen: 4000,
        guest_count: 2,
      }),
    ];

    const report = aggregateSalesReport(rows, range);

    expect(report.dailyBreakdown[0]?.confirmedRevenueYen).toBe(5000);
    expect(report.dailyBreakdown[0]?.projectedRevenueYen).toBe(18000);
    expect(report.businessBreakdown).toHaveLength(2);
  });
});

describe("filterRowsByDateRange", () => {
  it("期間内のみ残す", () => {
    const rows = [
      makeRow({ id: "1", reservation_date: "2026-06-01", status: "confirmed" }),
      makeRow({ id: "2", reservation_date: "2026-06-02", status: "confirmed" }),
    ];
    const filtered = filterRowsByDateRange(rows, {
      dateFrom: "2026-06-02",
      dateTo: "2026-06-02",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("2");
  });
});

describe("filterSalesRowsForProfile", () => {
  const admin = { id: "admin", role: "admin" as const };
  const businessAdmin = { id: "ba", role: "business_admin" as const };

  const rows = [
    makeRow({ id: "a", reservation_date: "2026-06-01", status: "confirmed", business_id: bizA }),
    makeRow({ id: "b", reservation_date: "2026-06-01", status: "confirmed", business_id: bizB }),
  ];

  it("admin は全売上を取得できる", () => {
    expect(filterSalesRowsForProfile(rows, admin, [])).toHaveLength(2);
  });

  it("business_admin は担当 business の売上だけ取得できる", () => {
    const filtered = filterSalesRowsForProfile(rows, businessAdmin, [bizA]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.business_id).toBe(bizA);
  });
});

describe("revenue flags", () => {
  it("isConfirmedRevenue は payment succeeded のみ", () => {
    expect(
      isConfirmedRevenue(
        makeRow({
          id: "1",
          reservation_date: "2026-06-01",
          status: "confirmed",
          payments: { status: "succeeded", amount_yen: 1000 },
        }),
      ),
    ).toBe(true);
    expect(
      isConfirmedRevenue(
        makeRow({
          id: "2",
          reservation_date: "2026-06-01",
          status: "confirmed",
          payments: { status: "pending", amount_yen: 1000 },
        }),
      ),
    ).toBe(false);
  });

  it("isProjectedRevenue は confirmed のみ", () => {
    expect(isProjectedRevenue(makeRow({ id: "1", reservation_date: "2026-06-01", status: "confirmed" }))).toBe(
      true,
    );
    expect(isProjectedRevenue(makeRow({ id: "2", reservation_date: "2026-06-01", status: "pending" }))).toBe(
      false,
    );
  });
});

describe("resolvePlanDisplayName", () => {
  it("空のプラン名はフォールバック", () => {
    expect(
      resolvePlanDisplayName(
        makeRow({
          id: "1",
          reservation_date: "2026-06-01",
          status: "confirmed",
          reserved_plan_name: "  ",
        }),
      ),
    ).toBe("（プラン名なし）");
  });
});

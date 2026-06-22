import { describe, expect, it } from "vitest";
import { aggregateSalesReport } from "@/lib/sales/sales-aggregation";
import {
  UTF8_BOM,
  buildBusinessSalesCsv,
  buildCsvContent,
  buildDailySalesCsv,
  buildPaymentMethodSalesCsv,
  buildPlanSalesCsv,
  buildSalesCsvByType,
  buildSalesCsvExportUrl,
  buildSalesCsvFilename,
  escapeCsvField,
  parseSalesCsvType,
} from "@/lib/sales/sales-csv";
import type { SalesReport } from "@/lib/sales/sales-types";

const emptyReport = (overrides: Partial<SalesReport> = {}): SalesReport => ({
  dateFrom: "2026-06-01",
  dateTo: "2026-06-30",
  confirmedRevenueYen: 0,
  projectedRevenueYen: 0,
  reservationCount: 0,
  cancelledCount: 0,
  paymentMethodBreakdown: { online: 0, cash_at_venue: 0 },
  paymentMethodDetailBreakdown: [],
  dailyBreakdown: [],
  businessBreakdown: [],
  planBreakdown: [],
  ...overrides,
});

describe("escapeCsvField", () => {
  it("通常の値はそのまま", () => {
    expect(escapeCsvField("事業A")).toBe("事業A");
    expect(escapeCsvField(1000)).toBe("1000");
  });

  it("カンマ・ダブルクォート・改行を含む値をエスケープする", () => {
    expect(escapeCsvField('株式会社"A",B')).toBe('"株式会社""A"",B"');
    expect(escapeCsvField("1行目\n2行目")).toBe('"1行目\n2行目"');
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });
});

describe("buildCsvContent", () => {
  it("BOM 付き UTF-8 で出力する", () => {
    const csv = buildCsvContent(["列1"], [["値"]]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
  });
});

describe("parseSalesCsvType", () => {
  it("有効な type を受け付ける", () => {
    expect(parseSalesCsvType("daily")).toBe("daily");
    expect(parseSalesCsvType("paymentMethod")).toBe("paymentMethod");
  });

  it("不正な type は null", () => {
    expect(parseSalesCsvType("invalid")).toBeNull();
    expect(parseSalesCsvType(null)).toBeNull();
  });
});

describe("buildSalesCsvFilename", () => {
  it("集計種別と期間を含む", () => {
    expect(buildSalesCsvFilename("daily", "2026-06-01", "2026-06-30")).toBe(
      "sales-daily-2026-06-01_2026-06-30.csv",
    );
  });
});

describe("buildSalesCsvExportUrl", () => {
  it("期間パラメータを引き継ぐ", () => {
    expect(buildSalesCsvExportUrl("business", "2026-06-01", "2026-06-30")).toBe(
      "/admin/sales/export?type=business&dateFrom=2026-06-01&dateTo=2026-06-30",
    );
  });
});

describe("buildDailySalesCsv", () => {
  it("日本語ヘッダーと数値金額で日別 CSV を出力する", () => {
    const report = emptyReport({
      dailyBreakdown: [
        {
          date: "2026-06-10",
          confirmedRevenueYen: 5000,
          projectedRevenueYen: 8000,
          reservationCount: 2,
          cancelledCount: 1,
        },
      ],
    });

    const csv = buildDailySalesCsv(report);
    expect(csv).toContain("日付,確定売上,売上見込み,予約件数,キャンセル件数");
    expect(csv).toContain("2026-06-10,5000,8000,2,1");
  });

  it("データなしでもヘッダーのみ出力できる", () => {
    const csv = buildDailySalesCsv(emptyReport());
    expect(csv).toContain("日付,確定売上,売上見込み,予約件数,キャンセル件数");
    expect(csv.trimEnd().endsWith("キャンセル件数")).toBe(true);
  });
});

describe("buildBusinessSalesCsv", () => {
  it("事業者別 CSV を出力する", () => {
    const report = emptyReport({
      businessBreakdown: [
        {
          businessId: "biz-1",
          businessName: "テスト事業",
          confirmedRevenueYen: 3000,
          projectedRevenueYen: 6000,
          reservationCount: 1,
          cancelledCount: 2,
        },
      ],
    });

    const csv = buildBusinessSalesCsv(report);
    expect(csv).toContain("事業者名,確定売上,売上見込み,予約件数,キャンセル件数");
    expect(csv).toContain("テスト事業,3000,6000,1,2");
  });
});

describe("buildPlanSalesCsv", () => {
  it("プラン別 CSV を出力する", () => {
    const report = emptyReport({
      planBreakdown: [
        {
          planName: "半日プラン",
          confirmedRevenueYen: 4000,
          projectedRevenueYen: 9000,
          reservationCount: 3,
          cancelledCount: 0,
        },
      ],
    });

    const csv = buildPlanSalesCsv(report);
    expect(csv).toContain("プラン名,確定売上,売上見込み,予約件数,キャンセル件数");
    expect(csv).toContain("半日プラン,4000,9000,3,0");
  });

  it("カンマを含むプラン名をエスケープする", () => {
    const report = emptyReport({
      planBreakdown: [
        {
          planName: "朝,夕セット",
          confirmedRevenueYen: 1000,
          projectedRevenueYen: 2000,
          reservationCount: 1,
          cancelledCount: 0,
        },
      ],
    });

    const csv = buildPlanSalesCsv(report);
    expect(csv).toContain('"朝,夕セット",1000,2000,1,0');
  });
});

describe("buildPaymentMethodSalesCsv", () => {
  it("支払い方法別 CSV を出力する", () => {
    const report = emptyReport({
      paymentMethodDetailBreakdown: [
        {
          paymentMethod: "online",
          label: "オンライン決済",
          confirmedRevenueYen: 7000,
          projectedRevenueYen: 10000,
          reservationCount: 4,
        },
      ],
    });

    const csv = buildPaymentMethodSalesCsv(report);
    expect(csv).toContain("支払い方法,確定売上,売上見込み,予約件数");
    expect(csv).toContain("オンライン決済,7000,10000,4");
  });
});

describe("buildSalesCsvByType", () => {
  it("type に応じた CSV を返す", () => {
    const report = emptyReport({
      dailyBreakdown: [
        {
          date: "2026-06-01",
          confirmedRevenueYen: 1,
          projectedRevenueYen: 2,
          reservationCount: 3,
          cancelledCount: 4,
        },
      ],
    });

    expect(buildSalesCsvByType("daily", report)).toContain("2026-06-01,1,2,3,4");
  });
});

describe("CSV と集計の整合", () => {
  it("期間外データは CSV に含まれない", () => {
    const rows = [
      {
        id: "in",
        reservation_date: "2026-06-15",
        status: "confirmed" as const,
        payment_method: "online" as const,
        guest_count: 1,
        total_amount_yen: 5000,
        reserved_plan_name: "プランA",
        reserved_unit_price_yen: 5000,
        business_id: "biz-a",
        business_name: "事業A",
        payments: { status: "succeeded" as const, amount_yen: 5000 },
      },
      {
        id: "out",
        reservation_date: "2026-07-01",
        status: "confirmed" as const,
        payment_method: "online" as const,
        guest_count: 1,
        total_amount_yen: 9000,
        reserved_plan_name: "プランB",
        reserved_unit_price_yen: 9000,
        business_id: "biz-a",
        business_name: "事業A",
        payments: { status: "succeeded" as const, amount_yen: 9000 },
      },
    ];

    const report = aggregateSalesReport(rows, {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
    });
    const csv = buildDailySalesCsv(report);

    expect(csv).toContain("2026-06-15,5000");
    expect(csv).not.toContain("2026-07-01");
    expect(csv).not.toContain("9000");
  });
});

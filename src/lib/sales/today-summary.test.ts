import { describe, expect, it } from "vitest";
import { aggregateTodaySummary, categorizePaymentMethod } from "@/lib/sales/today-summary";
import type { TodaySalesRawRow } from "@/lib/sales/sales-types";

describe("categorizePaymentMethod", () => {
  it("null は other に分類される", () => {
    expect(categorizePaymentMethod(null)).toBe("other");
  });

  it("空文字は other に分類される", () => {
    expect(categorizePaymentMethod("")).toBe("other");
  });

  it("cash → cash", () => {
    expect(categorizePaymentMethod("cash")).toBe("cash");
  });

  it("cash_at_venue → cash", () => {
    expect(categorizePaymentMethod("cash_at_venue")).toBe("cash");
  });

  it("online → card", () => {
    expect(categorizePaymentMethod("online")).toBe("card");
  });

  it("stripe → card", () => {
    expect(categorizePaymentMethod("stripe")).toBe("card");
  });

  it("card → card", () => {
    expect(categorizePaymentMethod("card")).toBe("card");
  });

  it("credit_card → card", () => {
    expect(categorizePaymentMethod("credit_card")).toBe("card");
  });

  it("e_money → eMoney", () => {
    expect(categorizePaymentMethod("e_money")).toBe("eMoney");
  });

  it("qr → qr", () => {
    expect(categorizePaymentMethod("qr")).toBe("qr");
  });

  it("other → other", () => {
    expect(categorizePaymentMethod("other")).toBe("other");
  });

  it("未知の値は other に分類される", () => {
    expect(categorizePaymentMethod("paypay")).toBe("other");
  });
});

describe("aggregateTodaySummary", () => {
  const date = "2026-06-24";

  it("空のrows → 全て0", () => {
    const result = aggregateTodaySummary([], date);
    expect(result.totalAmountYen).toBe(0);
    expect(result.transactionCount).toBe(0);
    expect(result.byPaymentMethod).toEqual({ cash: 0, card: 0, eMoney: 0, qr: 0, other: 0 });
    expect(result.date).toBe(date);
  });

  it("単一行の現金売上を集計する", () => {
    const rows: TodaySalesRawRow[] = [{ amountYen: 5000, paymentMethod: "cash" }];
    const result = aggregateTodaySummary(rows, date);
    expect(result.totalAmountYen).toBe(5000);
    expect(result.transactionCount).toBe(1);
    expect(result.byPaymentMethod.cash).toBe(5000);
    expect(result.byPaymentMethod.card).toBe(0);
  });

  it("複数の支払方法を正しく集計する", () => {
    const rows: TodaySalesRawRow[] = [
      { amountYen: 10000, paymentMethod: "cash_at_venue" },
      { amountYen: 8000, paymentMethod: "online" },
      { amountYen: 3000, paymentMethod: "e_money" },
      { amountYen: 2000, paymentMethod: "qr" },
      { amountYen: 1000, paymentMethod: "other" },
    ];
    const result = aggregateTodaySummary(rows, date);
    expect(result.totalAmountYen).toBe(24000);
    expect(result.transactionCount).toBe(5);
    expect(result.byPaymentMethod.cash).toBe(10000);
    expect(result.byPaymentMethod.card).toBe(8000);
    expect(result.byPaymentMethod.eMoney).toBe(3000);
    expect(result.byPaymentMethod.qr).toBe(2000);
    expect(result.byPaymentMethod.other).toBe(1000);
  });

  it("同一支払方法の複数行を合算する", () => {
    const rows: TodaySalesRawRow[] = [
      { amountYen: 3000, paymentMethod: "cash" },
      { amountYen: 2000, paymentMethod: "cash" },
      { amountYen: 5000, paymentMethod: "stripe" },
    ];
    const result = aggregateTodaySummary(rows, date);
    expect(result.byPaymentMethod.cash).toBe(5000);
    expect(result.byPaymentMethod.card).toBe(5000);
    expect(result.totalAmountYen).toBe(10000);
    expect(result.transactionCount).toBe(3);
  });

  it("payment_method が null の行は other に計上される", () => {
    const rows: TodaySalesRawRow[] = [{ amountYen: 7000, paymentMethod: null }];
    const result = aggregateTodaySummary(rows, date);
    expect(result.byPaymentMethod.other).toBe(7000);
    expect(result.totalAmountYen).toBe(7000);
  });

  it("負の金額は 0 として扱われる（ガード）", () => {
    const rows: TodaySalesRawRow[] = [{ amountYen: -500, paymentMethod: "cash" }];
    const result = aggregateTodaySummary(rows, date);
    expect(result.totalAmountYen).toBe(0);
    expect(result.byPaymentMethod.cash).toBe(0);
  });

  it("予約・手動売上・POSが混在する場合も正しく集計する", () => {
    // 予約（online）
    const rows: TodaySalesRawRow[] = [
      { amountYen: 15000, paymentMethod: "online" },         // 予約
      { amountYen: 3000, paymentMethod: "cash" },            // 手動売上
      { amountYen: 2000, paymentMethod: "credit_card" },     // 商品販売
      { amountYen: 8000, paymentMethod: "cash" },            // POSセッション
    ];
    const result = aggregateTodaySummary(rows, date);
    expect(result.totalAmountYen).toBe(28000);
    expect(result.transactionCount).toBe(4);
    expect(result.byPaymentMethod.card).toBe(17000); // online + credit_card
    expect(result.byPaymentMethod.cash).toBe(11000); // cash × 2
  });
});

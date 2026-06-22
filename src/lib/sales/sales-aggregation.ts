import {
  getLatestReservationPayment,
  resolveReservationPaymentStatus,
} from "@/lib/reservations/payment-status-display";
import type { PaymentMethod } from "@/lib/reservations/payment-method";
import type {
  BusinessSalesRow,
  DailySalesRow,
  PaymentMethodSalesBreakdown,
  PaymentMethodSalesDetailRow,
  PlanSalesRow,
  SalesDateRange,
  SalesReport,
  SalesReservationRow,
} from "@/lib/sales/sales-types";

/** 予約時スナップショットの単価 × 人数を優先し、なければ total_amount_yen を使う */
export function resolveReservationAmountYen(row: SalesReservationRow): number {
  if (row.reserved_unit_price_yen != null && row.guest_count > 0) {
    return row.reserved_unit_price_yen * row.guest_count;
  }
  return row.total_amount_yen;
}

export function resolveConfirmedPaymentAmountYen(row: SalesReservationRow): number {
  const payment = getLatestReservationPayment(row.payments);
  if (!payment || payment.status !== "succeeded") {
    return 0;
  }
  if (payment.amount_yen > 0) {
    return payment.amount_yen;
  }
  return resolveReservationAmountYen(row);
}

export function isConfirmedRevenue(row: SalesReservationRow): boolean {
  return resolveReservationPaymentStatus(row.payments) === "succeeded";
}

export function isProjectedRevenue(row: SalesReservationRow): boolean {
  return row.status === "confirmed";
}

export function isReservationCountTarget(row: SalesReservationRow): boolean {
  return row.status === "confirmed" || row.status === "pending";
}

export function isCancelledReservation(row: SalesReservationRow): boolean {
  return row.status === "cancelled";
}

export function isWithinDateRange(
  reservationDate: string,
  range: SalesDateRange,
): boolean {
  return reservationDate >= range.dateFrom && reservationDate <= range.dateTo;
}

export function filterRowsByDateRange(
  rows: SalesReservationRow[],
  range: SalesDateRange,
): SalesReservationRow[] {
  return rows.filter((row) => isWithinDateRange(row.reservation_date, range));
}

export function resolvePlanDisplayName(row: SalesReservationRow): string {
  const name = row.reserved_plan_name?.trim();
  return name && name.length > 0 ? name : "（プラン名なし）";
}

function emptyPaymentBreakdown(): PaymentMethodSalesBreakdown {
  return { online: 0, cash_at_venue: 0 };
}

function addToPaymentBreakdown(
  breakdown: PaymentMethodSalesBreakdown,
  paymentMethod: PaymentMethod,
  amount: number,
): void {
  if (paymentMethod === "online") {
    breakdown.online += amount;
  } else if (paymentMethod === "cash_at_venue") {
    breakdown.cash_at_venue += amount;
  }
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  online: "オンライン決済",
  cash_at_venue: "現地現金",
};

function emptyPaymentMethodDetail(
  paymentMethod: PaymentMethod,
): PaymentMethodSalesDetailRow {
  return {
    paymentMethod,
    label: PAYMENT_METHOD_LABELS[paymentMethod],
    confirmedRevenueYen: 0,
    projectedRevenueYen: 0,
    reservationCount: 0,
  };
}

export function aggregateSalesReport(
  rows: SalesReservationRow[],
  range: SalesDateRange,
): SalesReport {
  const inRange = filterRowsByDateRange(rows, range);

  let confirmedRevenueYen = 0;
  let projectedRevenueYen = 0;
  let reservationCount = 0;
  let cancelledCount = 0;
  const paymentMethodBreakdown = emptyPaymentBreakdown();
  const paymentMethodMap = new Map<PaymentMethod, PaymentMethodSalesDetailRow>();

  const dailyMap = new Map<string, DailySalesRow>();
  const businessMap = new Map<string, BusinessSalesRow>();
  const planMap = new Map<string, PlanSalesRow>();

  for (const row of inRange) {
    const amount = resolveReservationAmountYen(row);
    const confirmedAmount = isConfirmedRevenue(row)
      ? resolveConfirmedPaymentAmountYen(row)
      : 0;
    const projected = isProjectedRevenue(row);
    const isReservation = isReservationCountTarget(row);
    const isCancelled = isCancelledReservation(row);

    confirmedRevenueYen += confirmedAmount;
    if (projected) {
      projectedRevenueYen += amount;
    }
    if (isReservation) {
      reservationCount += 1;
    }
    if (isCancelled) {
      cancelledCount += 1;
    }

    if (confirmedAmount > 0) {
      addToPaymentBreakdown(paymentMethodBreakdown, row.payment_method, confirmedAmount);
    }

    const paymentMethodDetail =
      paymentMethodMap.get(row.payment_method) ??
      emptyPaymentMethodDetail(row.payment_method);
    paymentMethodDetail.confirmedRevenueYen += confirmedAmount;
    if (projected) {
      paymentMethodDetail.projectedRevenueYen += amount;
    }
    if (isReservation) {
      paymentMethodDetail.reservationCount += 1;
    }
    paymentMethodMap.set(row.payment_method, paymentMethodDetail);

    const daily = dailyMap.get(row.reservation_date) ?? {
      date: row.reservation_date,
      confirmedRevenueYen: 0,
      projectedRevenueYen: 0,
      reservationCount: 0,
      cancelledCount: 0,
    };
    daily.confirmedRevenueYen += confirmedAmount;
    if (projected) {
      daily.projectedRevenueYen += amount;
    }
    if (isReservation) {
      daily.reservationCount += 1;
    }
    if (isCancelled) {
      daily.cancelledCount += 1;
    }
    dailyMap.set(row.reservation_date, daily);

    if (projected || confirmedAmount > 0 || isReservation || isCancelled) {
      const businessKey = row.business_id ?? "__unknown__";
      const business = businessMap.get(businessKey) ?? {
        businessId: businessKey,
        businessName: row.business_name?.trim() || "（事業者なし）",
        confirmedRevenueYen: 0,
        projectedRevenueYen: 0,
        reservationCount: 0,
        cancelledCount: 0,
      };
      business.confirmedRevenueYen += confirmedAmount;
      if (projected) {
        business.projectedRevenueYen += amount;
        business.reservationCount += 1;
      }
      if (isCancelled) {
        business.cancelledCount += 1;
      }
      businessMap.set(businessKey, business);

      if (projected || confirmedAmount > 0 || isCancelled) {
        const planName = resolvePlanDisplayName(row);
        const plan = planMap.get(planName) ?? {
          planName,
          confirmedRevenueYen: 0,
          projectedRevenueYen: 0,
          reservationCount: 0,
          cancelledCount: 0,
        };
        plan.confirmedRevenueYen += confirmedAmount;
        if (projected) {
          plan.projectedRevenueYen += amount;
          plan.reservationCount += 1;
        }
        if (isCancelled) {
          plan.cancelledCount += 1;
        }
        planMap.set(planName, plan);
      }
    }
  }

  const dailyBreakdown = [...dailyMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const businessBreakdown = [...businessMap.values()].sort((a, b) =>
    a.businessName.localeCompare(b.businessName, "ja"),
  );
  const planBreakdown = [...planMap.values()].sort((a, b) =>
    a.planName.localeCompare(b.planName, "ja"),
  );
  const paymentMethodDetailBreakdown = [...paymentMethodMap.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "ja"),
  );

  return {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    confirmedRevenueYen,
    projectedRevenueYen,
    reservationCount,
    cancelledCount,
    paymentMethodBreakdown,
    paymentMethodDetailBreakdown,
    dailyBreakdown,
    businessBreakdown,
    planBreakdown,
  };
}

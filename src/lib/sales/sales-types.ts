import type { PaymentMethod } from "@/lib/reservations/payment-method";
import type { PaymentStatus, ReservationStatus } from "@/types/database";

export type SalesDateRange = {
  dateFrom: string;
  dateTo: string;
};

export type SalesReservationRow = {
  id: string;
  reservation_date: string;
  status: ReservationStatus;
  payment_method: PaymentMethod;
  guest_count: number;
  total_amount_yen: number;
  reserved_plan_name: string | null;
  reserved_unit_price_yen: number | null;
  business_id: string | null;
  business_name: string | null;
  payments:
    | { status: PaymentStatus; amount_yen: number }
    | Array<{ status: PaymentStatus; amount_yen: number }>
    | null;
};

export type PaymentMethodSalesBreakdown = {
  online: number;
  cash_at_venue: number;
};

export type DailySalesRow = {
  date: string;
  confirmedRevenueYen: number;
  projectedRevenueYen: number;
  reservationCount: number;
  cancelledCount: number;
};

export type BusinessSalesRow = {
  businessId: string;
  businessName: string;
  confirmedRevenueYen: number;
  projectedRevenueYen: number;
  reservationCount: number;
};

export type PlanSalesRow = {
  planName: string;
  confirmedRevenueYen: number;
  projectedRevenueYen: number;
  reservationCount: number;
};

export type SalesReport = {
  dateFrom: string;
  dateTo: string;
  confirmedRevenueYen: number;
  projectedRevenueYen: number;
  reservationCount: number;
  cancelledCount: number;
  paymentMethodBreakdown: PaymentMethodSalesBreakdown;
  dailyBreakdown: DailySalesRow[];
  businessBreakdown: BusinessSalesRow[];
  planBreakdown: PlanSalesRow[];
};

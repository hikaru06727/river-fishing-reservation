import {
  getPaymentMethodLabel,
  getPaymentStateColor,
  getPaymentStateLabel,
  inferPaymentMethod,
  type PaymentDisplayInput,
  type PaymentMethod,
} from "@/lib/reservations/payment-method";
import { resolveReservationPaymentStatus } from "@/lib/reservations/payment-status-display";
import type { PaymentStatus, ReservationStatus } from "@/types/database";

export type ReservationPaymentInfo = {
  paymentMethod: PaymentMethod;
  paymentStateLabel: string;
  paymentStateColor: string;
  paymentMethodLabel: string;
};

export function buildReservationPaymentInfo(input: {
  payment_method?: PaymentMethod | string | null;
  status: ReservationStatus;
  payments?: Array<{ status: PaymentStatus }> | null;
}): ReservationPaymentInfo {
  const paymentMethod = inferPaymentMethod(input);
  const paymentStatus = resolveReservationPaymentStatus(input.payments ?? null);

  const displayInput: PaymentDisplayInput = {
    paymentMethod,
    reservationStatus: input.status,
    paymentStatus,
  };

  return {
    paymentMethod,
    paymentMethodLabel: getPaymentMethodLabel(paymentMethod),
    paymentStateLabel: getPaymentStateLabel(displayInput),
    paymentStateColor: getPaymentStateColor(displayInput),
  };
}

interface ReservationPaymentSummaryProps {
  paymentMethodLabel: string;
  paymentStateLabel: string;
  paymentStateColor: string;
  layout?: "row" | "stack";
}

export function ReservationPaymentSummary({
  paymentMethodLabel,
  paymentStateLabel,
  paymentStateColor,
  layout = "row",
}: ReservationPaymentSummaryProps) {
  if (layout === "stack") {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted">支払い方法</span>
          <span className="font-medium">{paymentMethodLabel}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">支払い状態</span>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentStateColor}`}
          >
            {paymentStateLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted">支払い方法</dt>
        <dd className="font-medium">{paymentMethodLabel}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted">支払い状態</dt>
        <dd>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentStateColor}`}
          >
            {paymentStateLabel}
          </span>
        </dd>
      </div>
    </dl>
  );
}

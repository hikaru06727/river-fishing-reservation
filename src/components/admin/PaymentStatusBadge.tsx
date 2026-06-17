import {
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from "@/lib/reservations/payment-status-display";
import type { PaymentStatus } from "@/types/domain";

interface PaymentStatusBadgeProps {
  status: PaymentStatus | null | undefined;
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentStatusColor(status)}`}
    >
      {getPaymentStatusLabel(status)}
    </span>
  );
}

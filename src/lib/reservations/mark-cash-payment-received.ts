import type { PaymentMethod } from "@/lib/reservations/payment-method";
import type { PaymentStatus, ReservationStatus } from "@/types/database";

export type MarkCashPaymentReceivedInput = {
  payment_method: PaymentMethod | string | null | undefined;
  reservation_status: ReservationStatus;
  payment_status: PaymentStatus | null | undefined;
};

/** 管理画面で「現地で支払い済みにする」ボタンを表示してよいか */
export function canMarkCashPaymentReceived(input: MarkCashPaymentReceivedInput): boolean {
  return (
    input.payment_method === "cash_at_venue" &&
    input.reservation_status === "confirmed" &&
    input.payment_status === "pending"
  );
}

/** 現金精算が完了済みで操作不要な状態か */
export function isCashPaymentAlreadyReceived(input: MarkCashPaymentReceivedInput): boolean {
  return (
    input.payment_method === "cash_at_venue" &&
    input.reservation_status === "confirmed" &&
    input.payment_status === "succeeded"
  );
}

import type { PaymentMethod } from "@/lib/reservations/payment-method";
import {
  getLatestReservationPayment,
  type ReservationPaymentEmbed,
} from "@/lib/reservations/payment-status-display";
import type { PaymentStatus, ReservationStatus } from "@/types/database";

export type MarkCashPaymentReceivedInput = {
  payment_method: PaymentMethod | string | null | undefined;
  reservation_status: ReservationStatus;
  payment_status: PaymentStatus | null | undefined;
  paid_at?: string | null;
};

/** 管理画面で「現地で支払い済みにする」ボタンを表示してよいか */
export function canMarkCashPaymentReceived(input: MarkCashPaymentReceivedInput): boolean {
  return (
    input.payment_method === "cash_at_venue" &&
    input.reservation_status === "confirmed" &&
    input.payment_status === "pending" &&
    (input.paid_at == null || input.paid_at === "")
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

export type AdminCashPaymentUiState = {
  showMarkButton: boolean;
  showAlreadyPaid: boolean;
  showMissingPaymentNote: boolean;
};

/** 管理予約詳細の現金精算 UI 表示状態 */
export function getAdminCashPaymentUiState(input: {
  payment_method: PaymentMethod | string | null | undefined;
  reservation_status: ReservationStatus;
  payments: ReservationPaymentEmbed | ReservationPaymentEmbed[] | null | undefined;
}): AdminCashPaymentUiState {
  const latestPayment = getLatestReservationPayment(input.payments);
  const markInput: MarkCashPaymentReceivedInput = {
    payment_method: input.payment_method,
    reservation_status: input.reservation_status,
    payment_status: latestPayment?.status ?? null,
    paid_at: latestPayment?.paid_at ?? null,
  };

  const isCash = input.payment_method === "cash_at_venue";

  return {
    showMarkButton: canMarkCashPaymentReceived(markInput),
    showAlreadyPaid: isCashPaymentAlreadyReceived(markInput),
    showMissingPaymentNote:
      isCash && input.reservation_status === "confirmed" && latestPayment == null,
  };
}

import type { PaymentStatus, ReservationStatus } from "@/types/database";

/** reservations.payment_method（DB: online | cash_at_venue） */
export type PaymentMethod = "online" | "cash_at_venue";

export const PAYMENT_METHODS = ["online", "cash_at_venue"] as const satisfies readonly PaymentMethod[];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  online: "オンライン決済（カード）",
  cash_at_venue: "当日現金精算",
};

export const PAYMENT_METHOD_DESCRIPTIONS: Record<PaymentMethod, string> = {
  online: "予約後にカード決済ページへ進みます。決済完了で予約が確定します（30分以内）。",
  cash_at_venue:
    "予約時点で枠を確保します。当日受付で現金をお支払いください。事前のカード決済は不要です。",
};

export type PaymentDisplayInput = {
  paymentMethod: PaymentMethod;
  reservationStatus: ReservationStatus;
  paymentStatus: PaymentStatus | null;
};

/** DB カラム追加前は online 固定。将来は row.payment_method を優先 */
export function inferPaymentMethod(
  reservation: { payment_method?: PaymentMethod | string | null },
): PaymentMethod {
  if (
    reservation.payment_method === "cash_at_venue" ||
    reservation.payment_method === "online"
  ) {
    return reservation.payment_method;
  }
  return "online";
}

export function parsePaymentMethod(value: unknown): PaymentMethod | null {
  if (value === "online" || value === "cash_at_venue") {
    return value;
  }
  return null;
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}

export function getPaymentMethodDescription(method: PaymentMethod): string {
  return PAYMENT_METHOD_DESCRIPTIONS[method];
}

export type PaymentStateLabel =
  | "キャンセル済"
  | "期限切れ"
  | "現地精算済"
  | "当日精算予定"
  | "決済期限切れ"
  | "決済済み"
  | "決済失敗"
  | "返金済"
  | "決済待ち";

/** ユーザー向け：支払い状態（方法 + 進捗） */
export function getPaymentStateLabel(input: PaymentDisplayInput): PaymentStateLabel {
  const { paymentMethod, reservationStatus, paymentStatus } = input;

  if (paymentMethod === "cash_at_venue") {
    if (reservationStatus === "cancelled") {
      return "キャンセル済";
    }
    if (reservationStatus === "expired") {
      return "期限切れ";
    }
    if (paymentStatus === "succeeded") {
      return "現地精算済";
    }
    if (reservationStatus === "confirmed") {
      return "当日精算予定";
    }
    return "当日精算予定";
  }

  // online
  if (reservationStatus === "expired") {
    return "決済期限切れ";
  }
  if (reservationStatus === "cancelled") {
    return "キャンセル済";
  }
  if (paymentStatus === "succeeded" || reservationStatus === "confirmed") {
    return "決済済み";
  }
  if (paymentStatus === "failed") {
    return "決済失敗";
  }
  if (paymentStatus === "refunded") {
    return "返金済";
  }
  return "決済待ち";
}

/**
 * ラベルを Record のキーに使うことで、PaymentStateLabel に新しい値を
 * 追加した際にこのマッピングの更新漏れを tsc がコンパイルエラーとして
 * 検出できるようにしている。
 */
const PAYMENT_STATE_COLORS: Record<PaymentStateLabel, string> = {
  決済済み: "bg-green-100 text-green-800",
  現地精算済: "bg-green-100 text-green-800",
  当日精算予定: "bg-yellow-100 text-yellow-800",
  決済待ち: "bg-yellow-100 text-yellow-800",
  決済期限切れ: "bg-red-100 text-red-800",
  期限切れ: "bg-red-100 text-red-800",
  決済失敗: "bg-red-100 text-red-800",
  キャンセル済: "bg-slate-100 text-slate-600",
  返金済: "bg-slate-100 text-slate-600",
};

export function getPaymentStateColor(input: PaymentDisplayInput): string {
  return PAYMENT_STATE_COLORS[getPaymentStateLabel(input)];
}

/** Stripe Checkout に進むべきか（現金精算は false） */
export function shouldProceedToStripeCheckout(paymentMethod: PaymentMethod): boolean {
  return paymentMethod === "online";
}

/** pending 自動失効 Cron の対象か（現金精算 confirmed は false） */
export function shouldExpirePendingReservation(
  paymentMethod: PaymentMethod,
  reservationStatus: ReservationStatus,
): boolean {
  if (reservationStatus !== "pending") {
    return false;
  }
  return paymentMethod === "online";
}

/** 現金精算予約作成時の推奨 reservations.status（設計上の定数） */
export function getInitialReservationStatusForPaymentMethod(
  paymentMethod: PaymentMethod,
): ReservationStatus {
  return paymentMethod === "cash_at_venue" ? "confirmed" : "pending";
}

/** 現金精算予約作成時の expires_at（設計上: null） */
export function getExpiresAtForPaymentMethod(
  paymentMethod: PaymentMethod,
  onlineExpiresAt: string,
): string | null {
  return paymentMethod === "cash_at_venue" ? null : onlineExpiresAt;
}

import type { PaymentStatus } from "@/types/database";

export type ReservationPaymentEmbed = {
  status: PaymentStatus;
  paid_at?: string | null;
};

/**
 * Supabase の embed: 1:1 関係（payments.reservation_id UNIQUE）では object、
 * 1:N として解釈される場合は array で返ることがある。
 */
export function normalizeReservationPayments<T extends ReservationPaymentEmbed>(
  payments: T | T[] | null | undefined,
): T[] {
  if (payments == null) {
    return [];
  }
  if (Array.isArray(payments)) {
    return payments;
  }
  if (typeof payments === "object" && "status" in payments) {
    return [payments];
  }
  return [];
}

/** 正規化後の先頭 payment（通常 1 件） */
export function getLatestReservationPayment<T extends ReservationPaymentEmbed>(
  payments: T | T[] | null | undefined,
): T | null {
  return normalizeReservationPayments(payments)[0] ?? null;
}

export function getPaymentStatusLabel(status: PaymentStatus | null | undefined): string {
  if (!status) {
    return "未決済";
  }

  const labels: Record<PaymentStatus, string> = {
    pending: "決済待ち",
    succeeded: "決済完了",
    failed: "決済失敗",
    refunded: "返金済",
    partially_refunded: "部分返金",
    expired: "期限切れ",
    disputed: "異議申立中",
  };

  return labels[status];
}

export function getPaymentStatusColor(status: PaymentStatus | null | undefined): string {
  if (!status) {
    return "bg-slate-100 text-slate-600";
  }

  const colors: Record<PaymentStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    succeeded: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    refunded: "bg-purple-100 text-purple-800",
    partially_refunded: "bg-violet-100 text-violet-800",
    expired: "bg-slate-100 text-slate-600",
    disputed: "bg-orange-100 text-orange-800",
  };

  return colors[status];
}

/** 予約に紐づく payments から表示用ステータスを決定 */
export function resolveReservationPaymentStatus(
  payments:
    | Array<{ status: PaymentStatus }>
    | { status: PaymentStatus }
    | null
    | undefined,
): PaymentStatus | null {
  const list = normalizeReservationPayments(payments);
  if (!list.length) {
    return null;
  }

  const priority: PaymentStatus[] = ["succeeded", "refunded", "pending", "failed"];
  for (const status of priority) {
    if (list.some((p) => p.status === status)) {
      return status;
    }
  }

  return list[0]?.status ?? null;
}

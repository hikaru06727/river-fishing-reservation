import type { PaymentStatus } from "@/types/database";

export function getPaymentStatusLabel(status: PaymentStatus | null | undefined): string {
  if (!status) {
    return "未決済";
  }

  const labels: Record<PaymentStatus, string> = {
    pending: "決済待ち",
    succeeded: "決済完了",
    failed: "決済失敗",
    refunded: "返金済",
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
  };

  return colors[status];
}

/** 予約に紐づく payments 配列から表示用ステータスを決定 */
export function resolveReservationPaymentStatus(
  payments: Array<{ status: PaymentStatus }> | null | undefined,
): PaymentStatus | null {
  if (!payments?.length) {
    return null;
  }

  const priority: PaymentStatus[] = ["succeeded", "refunded", "pending", "failed"];
  for (const status of priority) {
    if (payments.some((p) => p.status === status)) {
      return status;
    }
  }

  return payments[0]?.status ?? null;
}

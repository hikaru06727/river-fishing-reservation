import { getReservationStartAtJst, isBeforeUserCancelDeadline } from "@/lib/utils/date";
import type { ReservationStatus } from "@/types/database";

export type CancelPolicyInput = {
  status: ReservationStatus;
  reservationDate: string;
  startTime: string;
  isAdmin?: boolean;
  now?: Date;
};

export type CancelPolicyResult = {
  allowed: boolean;
  reason?: string;
};

const NON_CANCELLABLE_MESSAGE = "この予約はキャンセルできません。";
const DEADLINE_MESSAGE =
  "利用開始24時間前を過ぎているため、キャンセルできません。";

/**
 * キャンセル可否を判定する。
 * - 一般ユーザー: confirmed のみ、利用開始24時間前まで（now >= startAt - 24h は不可）
 * - 管理者: confirmed / pending のみ、期限制限なし
 */
export function canCancelReservation(input: CancelPolicyInput): CancelPolicyResult {
  const { status, reservationDate, startTime, isAdmin = false, now = new Date() } = input;

  if (status === "cancelled" || status === "expired") {
    return { allowed: false, reason: NON_CANCELLABLE_MESSAGE };
  }

  if (isAdmin) {
    if (status === "confirmed" || status === "pending") {
      return { allowed: true };
    }
    return { allowed: false, reason: NON_CANCELLABLE_MESSAGE };
  }

  if (status !== "confirmed") {
    return { allowed: false, reason: NON_CANCELLABLE_MESSAGE };
  }

  const startAt = getReservationStartAtJst(reservationDate, startTime);
  if (!isBeforeUserCancelDeadline(startAt, now)) {
    return { allowed: false, reason: DEADLINE_MESSAGE };
  }

  return { allowed: true };
}

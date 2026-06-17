import { unstable_noStore as noStore } from "next/cache";
import {
  findMyReservationsByUserId,
  type MyReservationRow,
} from "@/lib/repositories/reservations.repository";
import type { ReservationStatus } from "@/types/database";

export type MyReservation = MyReservationRow;

export async function getMyReservations(userId: string): Promise<MyReservation[]> {
  noStore();

  try {
    return await findMyReservationsByUserId(userId);
  } catch (error) {
    console.error("[getMyReservations]", error instanceof Error ? error.message : error);
    throw new Error("予約一覧の取得に失敗しました。");
  }
}

export {
  canCancelReservation,
  type CancelPolicyInput,
  type CancelPolicyResult,
} from "@/lib/reservations/cancel-policy";

export function getReservationStatusLabel(status: ReservationStatus): string {
  const labels: Record<ReservationStatus, string> = {
    pending: "仮予約（決済待ち）",
    confirmed: "確定",
    cancelled: "キャンセル済",
    expired: "期限切れ",
  };
  return labels[status];
}

export function getReservationStatusColor(status: ReservationStatus): string {
  const colors: Record<ReservationStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-green-100 text-green-800",
    cancelled: "bg-slate-100 text-slate-600",
    expired: "bg-red-100 text-red-800",
  };
  return colors[status];
}

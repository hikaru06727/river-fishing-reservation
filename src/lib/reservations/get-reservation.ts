import {
  findReservationDetailByIdForUser,
  type ReservationDetailRow,
} from "@/lib/repositories/reservations.repository";

export type ReservationDetail = ReservationDetailRow;

export async function getReservationById(
  id: string,
  userId: string,
): Promise<ReservationDetail | null> {
  try {
    return await findReservationDetailByIdForUser(id, userId);
  } catch (error) {
    console.error("[getReservationById]", error instanceof Error ? error.message : error);
    throw new Error("予約情報の取得に失敗しました。");
  }
}

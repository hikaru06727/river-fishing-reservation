import { sendReservationExpiredEmail } from "@/lib/email/reservation-expired-emails";
import {
  expirePendingReservationsRpc,
  findExpiredReservationsPendingEmail,
  markExpiredEmailSent,
} from "@/lib/repositories/reservations.repository";

export type ExpirePendingReservationsResult = {
  expiredCount: number;
  emailCandidates: number;
  emailsSent: number;
  emailsSkipped: number;
  emailsFailed: number;
};

/**
 * pending 期限切れ処理 + 期限切れメール送信。
 * 1. DB RPC で online pending を expired に更新
 * 2. expired + メール未送信の予約へ通知（pg_cron 先行失効分も含む）
 */
export async function processExpirePendingReservations(): Promise<ExpirePendingReservationsResult> {
  const expireResult = await expirePendingReservationsRpc();

  const candidates = await findExpiredReservationsPendingEmail();

  let emailsSent = 0;
  let emailsSkipped = 0;
  let emailsFailed = 0;

  for (const reservation of candidates) {
    const emailResult = await sendReservationExpiredEmail({
      reservationId: reservation.id,
      customerUserId: reservation.user_id,
      spotName: reservation.spotName,
      planName: reservation.planName,
      reservationDate: reservation.reservation_date,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      guestCount: reservation.guest_count,
    });

    if (!emailResult.sent) {
      emailsFailed += 1;
      continue;
    }

    if (emailResult.skipped) {
      emailsSkipped += 1;
      continue;
    }

    try {
      const marked = await markExpiredEmailSent(reservation.id);
      if (marked) {
        emailsSent += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.warn(
        "[processExpirePendingReservations] failed to mark expired_email_sent_at:",
        reservation.id,
        message,
      );
      emailsFailed += 1;
    }
  }

  return {
    expiredCount: expireResult.expired_count,
    emailCandidates: candidates.length,
    emailsSent,
    emailsSkipped,
    emailsFailed,
  };
}

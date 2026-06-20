import { beforeEach, describe, expect, it, vi } from "vitest";
import { processExpirePendingReservations } from "@/lib/services/expire-pending-reservations.service";

const {
  expirePendingReservationsRpcMock,
  findExpiredReservationsPendingEmailMock,
  markExpiredEmailSentMock,
  sendReservationExpiredEmailMock,
} = vi.hoisted(() => ({
  expirePendingReservationsRpcMock: vi.fn(),
  findExpiredReservationsPendingEmailMock: vi.fn(),
  markExpiredEmailSentMock: vi.fn(),
  sendReservationExpiredEmailMock: vi.fn(),
}));

vi.mock("@/lib/repositories/reservations.repository", () => ({
  expirePendingReservationsRpc: expirePendingReservationsRpcMock,
  findExpiredReservationsPendingEmail: findExpiredReservationsPendingEmailMock,
  markExpiredEmailSent: markExpiredEmailSentMock,
}));

vi.mock("@/lib/email/reservation-expired-emails", () => ({
  sendReservationExpiredEmail: sendReservationExpiredEmailMock,
}));

const onlineExpiredCandidate = {
  id: "res-online-expired",
  user_id: "user-1",
  spot_id: "spot-1",
  plan_id: "plan-1",
  reservation_date: "2026-06-20",
  start_time: "09:00:00",
  end_time: "13:00:00",
  guest_count: 2,
  payment_method: "online" as const,
  spotName: "テスト釣り場",
  planName: "半日プラン",
};

describe("processExpirePendingReservations", () => {
  beforeEach(() => {
    expirePendingReservationsRpcMock.mockReset();
    findExpiredReservationsPendingEmailMock.mockReset();
    markExpiredEmailSentMock.mockReset();
    sendReservationExpiredEmailMock.mockReset();

    expirePendingReservationsRpcMock.mockResolvedValue({
      expired_count: 1,
      reservation_ids: ["res-online-expired"],
    });
    findExpiredReservationsPendingEmailMock.mockResolvedValue([onlineExpiredCandidate]);
    sendReservationExpiredEmailMock.mockResolvedValue({ sent: true, skipped: false });
    markExpiredEmailSentMock.mockResolvedValue(true);
  });

  it("pending が expired になった予約にだけ期限切れメールを送る", async () => {
    const result = await processExpirePendingReservations();

    expect(expirePendingReservationsRpcMock).toHaveBeenCalledTimes(1);
    expect(findExpiredReservationsPendingEmailMock).toHaveBeenCalledTimes(1);
    expect(sendReservationExpiredEmailMock).toHaveBeenCalledTimes(1);
    expect(sendReservationExpiredEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: "res-online-expired" }),
    );
    expect(markExpiredEmailSentMock).toHaveBeenCalledWith("res-online-expired");
    expect(result.emailsSent).toBe(1);
    expect(result.expiredCount).toBe(1);
  });

  it("メール対象がなければ sendEmail を呼ばない", async () => {
    expirePendingReservationsRpcMock.mockResolvedValue({
      expired_count: 0,
      reservation_ids: [],
    });
    findExpiredReservationsPendingEmailMock.mockResolvedValue([]);

    const result = await processExpirePendingReservations();

    expect(sendReservationExpiredEmailMock).not.toHaveBeenCalled();
    expect(markExpiredEmailSentMock).not.toHaveBeenCalled();
    expect(result.emailsSent).toBe(0);
  });

  it("confirmed / cancelled / expired 済み（メール送信済み）は repository クエリで除外される", async () => {
    findExpiredReservationsPendingEmailMock.mockResolvedValue([]);

    await processExpirePendingReservations();

    expect(findExpiredReservationsPendingEmailMock).toHaveBeenCalledTimes(1);
    expect(sendReservationExpiredEmailMock).not.toHaveBeenCalled();
  });

  it("cash_at_venue は repository クエリで除外される", async () => {
    findExpiredReservationsPendingEmailMock.mockResolvedValue([]);

    await processExpirePendingReservations();

    expect(sendReservationExpiredEmailMock).not.toHaveBeenCalled();
  });

  it("expired_email_sent_at がある予約は repository クエリで除外される", async () => {
    findExpiredReservationsPendingEmailMock.mockResolvedValue([]);

    await processExpirePendingReservations();

    expect(sendReservationExpiredEmailMock).not.toHaveBeenCalled();
  });

  it("メール送信失敗時も期限切れ RPC 処理は成功扱い", async () => {
    sendReservationExpiredEmailMock.mockResolvedValue({ sent: false, reason: "send_failed" });

    const result = await processExpirePendingReservations();

    expect(expirePendingReservationsRpcMock).toHaveBeenCalledTimes(1);
    expect(markExpiredEmailSentMock).not.toHaveBeenCalled();
    expect(result.emailsFailed).toBe(1);
    expect(result.emailsSent).toBe(0);
  });

  it("EMAIL 無効（skipped）時は expired_email_sent_at を更新しない", async () => {
    sendReservationExpiredEmailMock.mockResolvedValue({ sent: true, skipped: true });

    const result = await processExpirePendingReservations();

    expect(markExpiredEmailSentMock).not.toHaveBeenCalled();
    expect(result.emailsSkipped).toBe(1);
    expect(result.emailsSent).toBe(0);
  });
});

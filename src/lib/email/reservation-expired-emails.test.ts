import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCustomerReservationExpiredEmail,
  sendReservationExpiredEmail,
  type ReservationExpiredEmailContext,
} from "@/lib/email/reservation-expired-emails";

const { sendEmailMock, findProfileEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  findProfileEmailMock: vi.fn(),
}));

vi.mock("@/lib/email/send-email", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("@/lib/repositories/profiles.repository", () => ({
  findProfileEmailByUserIdAdmin: findProfileEmailMock,
}));

const baseContext: ReservationExpiredEmailContext = {
  reservationId: "res-expired-1",
  customerUserId: "user-1",
  customerEmail: "customer@example.com",
  spotName: "テスト釣り場",
  planName: "半日プラン",
  reservationDate: "2026-06-20",
  startTime: "09:00:00",
  endTime: "13:00:00",
  guestCount: 2,
  paymentMethodLabel: "オンライン決済（カード）",
};

describe("reservation expired email content", () => {
  it("期限切れメールの件名と本文", () => {
    const email = buildCustomerReservationExpiredEmail(baseContext);

    expect(email.subject).toBe("【予約期限切れのお知らせ】ご予約は完了していません");
    expect(email.text).toContain("決済が完了しなかったため、期限切れとなりました");
    expect(email.text).toContain("予約枠は自動的に解放されています");
    expect(email.text).toContain("もう一度予約をお願いいたします");
    expect(email.text).toContain("予約番号: res-expired-1");
    expect(email.text).toContain("テスト釣り場");
    expect(email.text).toContain("人数: 2名");
    expect(email.text).toContain("オンライン決済（カード）");
  });
});

describe("sendReservationExpiredEmail", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    sendEmailMock.mockReset();
    findProfileEmailMock.mockReset();
    findProfileEmailMock.mockResolvedValue("customer@example.com");
    sendEmailMock.mockResolvedValue({ ok: true, id: "email-1" });
  });

  afterEach(() => {
    process.env = env;
    vi.restoreAllMocks();
  });

  it("EMAILS_ENABLED=false でも throw せず sendEmail を呼ぶ", async () => {
    process.env.EMAILS_ENABLED = "false";
    sendEmailMock.mockResolvedValue({ ok: true, skipped: true });

    await expect(
      sendReservationExpiredEmail({
        reservationId: "res-expired-1",
        customerUserId: "user-1",
        spotName: "テスト釣り場",
        planName: "半日プラン",
        reservationDate: "2026-06-20",
        startTime: "09:00:00",
        endTime: "13:00:00",
        guestCount: 2,
      }),
    ).resolves.toEqual({ sent: true, skipped: true });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("sendEmail 失敗時も throw しない", async () => {
    sendEmailMock.mockResolvedValue({ ok: false, error: "Resend error" });

    await expect(
      sendReservationExpiredEmail({
        reservationId: "res-expired-1",
        customerUserId: "user-1",
        spotName: "テスト釣り場",
        planName: "半日プラン",
        reservationDate: "2026-06-20",
        startTime: "09:00:00",
        endTime: "13:00:00",
        guestCount: 2,
      }),
    ).resolves.toEqual({ sent: false, reason: "send_failed" });
  });

  it("予約者メールアドレスへ sendEmail を呼ぶ", async () => {
    const result = await sendReservationExpiredEmail({
      reservationId: "res-expired-1",
      customerUserId: "user-1",
      spotName: "テスト釣り場",
      planName: "半日プラン",
      reservationDate: "2026-06-20",
      startTime: "09:00:00",
      endTime: "13:00:00",
      guestCount: 2,
    });

    expect(result).toEqual({ sent: true, skipped: false });
    expect(findProfileEmailMock).toHaveBeenCalledWith("user-1");
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        subject: "【予約期限切れのお知らせ】ご予約は完了していません",
      }),
    );
  });
});

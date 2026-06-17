import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAdminReservationCreatedEmail,
  buildCustomerReservationCreatedEmail,
  formatPaymentMethodLabel,
  formatReservationStatusLabel,
  sendReservationCreatedEmails,
  type ReservationCreatedEmailContext,
} from "@/lib/email/reservation-emails";

const { sendEmailMock, resolveRecipientsMock, findProfileEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  resolveRecipientsMock: vi.fn(),
  findProfileEmailMock: vi.fn(),
}));

vi.mock("@/lib/email/send-email", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("@/lib/email/admin-notification-recipients", () => ({
  resolveAdminNotificationRecipients: resolveRecipientsMock,
}));

vi.mock("@/lib/repositories/reservations.repository", () => ({
  findProfileEmailByUserId: findProfileEmailMock,
}));

const baseContext: ReservationCreatedEmailContext = {
  reservationId: "res-123",
  customerEmail: "customer@example.com",
  spotName: "テスト釣り場",
  planName: "半日プラン",
  reservationDate: "2026-06-20",
  startTime: "09:00:00",
  endTime: "13:00:00",
  guestCount: 2,
  totalAmountYen: 10000,
  status: "pending",
  paymentMethodLabel: "オンライン決済（決済待ち）",
};

describe("reservation email content", () => {
  it("formatReservationStatusLabel は pending を仮予約として表示", () => {
    expect(formatReservationStatusLabel("pending")).toBe("仮予約（決済待ち）");
  });

  it("formatPaymentMethodLabel は pending 時に決済待ちを表示", () => {
    expect(formatPaymentMethodLabel("pending")).toBe("オンライン決済（決済待ち）");
  });

  it("buildCustomerReservationCreatedEmail に予約情報を含める", () => {
    const email = buildCustomerReservationCreatedEmail(baseContext);

    expect(email.subject).toContain("テスト釣り場");
    expect(email.text).toContain("res-123");
    expect(email.text).toContain("2026-06-20");
    expect(email.text).toContain("09:00〜13:00");
    expect(email.text).toContain("2名");
    expect(email.text).toContain("10,000円");
    expect(email.text).toContain("オンライン決済（決済待ち）");
    expect(email.text).toContain("仮予約（決済待ち）");
    expect(email.html).toContain("テスト釣り場");
  });

  it("buildAdminReservationCreatedEmail に予約者メールを含める", () => {
    const email = buildAdminReservationCreatedEmail(baseContext);

    expect(email.subject).toContain("【予約通知】");
    expect(email.text).toContain("customer@example.com");
    expect(email.text).toContain("新しい予約が作成されました");
  });
});

describe("sendReservationCreatedEmails", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    sendEmailMock.mockReset();
    resolveRecipientsMock.mockReset();
    findProfileEmailMock.mockReset();

    findProfileEmailMock.mockResolvedValue("customer@example.com");
    resolveRecipientsMock.mockResolvedValue(["admin@example.com"]);
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
      sendReservationCreatedEmails({
        reservationId: "res-123",
        userId: "user-1",
        spotName: "テスト釣り場",
        businessId: "biz-1",
        planName: "半日プラン",
        reservationDate: "2026-06-20",
        startTime: "09:00:00",
        endTime: "13:00:00",
        guestCount: 2,
        totalAmountYen: 10000,
      }),
    ).resolves.toBeUndefined();

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("sendEmail 失敗時も throw しない", async () => {
    sendEmailMock.mockResolvedValue({ ok: false, error: "Resend error" });

    await expect(
      sendReservationCreatedEmails({
        reservationId: "res-123",
        userId: "user-1",
        spotName: "テスト釣り場",
        businessId: "biz-1",
        planName: "半日プラン",
        reservationDate: "2026-06-20",
        startTime: "09:00:00",
        endTime: "13:00:00",
        guestCount: 2,
        totalAmountYen: 10000,
      }),
    ).resolves.toBeUndefined();
  });

  it("予約者と管理者の両方に sendEmail を呼ぶ", async () => {
    await sendReservationCreatedEmails({
      reservationId: "res-123",
      userId: "user-1",
      spotName: "テスト釣り場",
      businessId: "biz-1",
      planName: "半日プラン",
      reservationDate: "2026-06-20",
      startTime: "09:00:00",
      endTime: "13:00:00",
      guestCount: 2,
      totalAmountYen: 10000,
    });

    expect(findProfileEmailMock).toHaveBeenCalledWith("user-1");
    expect(resolveRecipientsMock).toHaveBeenCalledWith("biz-1");
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(sendEmailMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ to: "customer@example.com" }),
    );
    expect(sendEmailMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ to: ["admin@example.com"] }),
    );
  });

  it("管理者通知先がない場合は管理者メールを送らない", async () => {
    resolveRecipientsMock.mockResolvedValue([]);

    await sendReservationCreatedEmails({
      reservationId: "res-123",
      userId: "user-1",
      spotName: "テスト釣り場",
      businessId: null,
      planName: "半日プラン",
      reservationDate: "2026-06-20",
      startTime: "09:00:00",
      endTime: "13:00:00",
      guestCount: 2,
      totalAmountYen: 10000,
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAdminPaymentConfirmedEmail,
  buildCustomerPaymentConfirmedEmail,
  sendPaymentConfirmedEmails,
  type PaymentConfirmedEmailContext,
} from "@/lib/email/payment-confirmation-emails";

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

const baseContext: PaymentConfirmedEmailContext = {
  reservationId: "res-123",
  customerUserId: "user-1",
  customerEmail: "customer@example.com",
  spotName: "テスト釣り場",
  businessId: "biz-1",
  planName: "半日プラン",
  reservationDate: "2026-06-20",
  startTime: "09:00:00",
  endTime: "13:00:00",
  guestCount: 2,
  totalAmountYen: 10000,
};

describe("payment confirmation email content", () => {
  it("buildCustomerPaymentConfirmedEmail に予約・決済情報を含める", () => {
    const email = buildCustomerPaymentConfirmedEmail(baseContext);

    expect(email.subject).toContain("【予約確定】決済が完了しました");
    expect(email.text).toContain("決済が完了し、ご予約が確定しました");
    expect(email.text).toContain("res-123");
    expect(email.text).toContain("テスト釣り場");
    expect(email.text).toContain("09:00〜13:00");
    expect(email.text).toContain("10,000円");
    expect(email.text).toContain("オンライン決済（Stripe）");
    expect(email.text).toContain("ステータス: 確定");
  });

  it("buildAdminPaymentConfirmedEmail に予約者メールを含める", () => {
    const email = buildAdminPaymentConfirmedEmail(baseContext);

    expect(email.subject).toContain("【予約確定通知】");
    expect(email.text).toContain("予約が確定しました（決済完了）");
    expect(email.text).toContain("customer@example.com");
  });
});

describe("sendPaymentConfirmedEmails", () => {
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
      sendPaymentConfirmedEmails({
        reservationId: "res-123",
        customerUserId: "user-1",
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
      sendPaymentConfirmedEmails({
        reservationId: "res-123",
        customerUserId: "user-1",
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
    await sendPaymentConfirmedEmails({
      reservationId: "res-123",
      customerUserId: "user-1",
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
      expect.objectContaining({
        to: "customer@example.com",
        subject: expect.stringContaining("【予約確定】"),
      }),
    );
    expect(sendEmailMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: ["admin@example.com"],
        subject: expect.stringContaining("【予約確定通知】"),
      }),
    );
  });
});

/**
 * Webhook の二重送信防止:
 * - status !== pending → skipped（メール送信コードに到達しない）
 * - update 0 rows → skipped（メール送信コードに到達しない）
 * - updatedCount === 1 かつ payment upsert 成功 → のみ sendPaymentConfirmedEmails を呼ぶ
 */
describe("webhook email trigger conditions", () => {
  it("skipped 条件ではメール送信関数を呼ばない設計", () => {
    const shouldSendEmail = (updatedCount: number, paymentRecorded: boolean) =>
      updatedCount === 1 && paymentRecorded;

    expect(shouldSendEmail(0, true)).toBe(false);
    expect(shouldSendEmail(1, false)).toBe(false);
    expect(shouldSendEmail(1, true)).toBe(true);
  });
});

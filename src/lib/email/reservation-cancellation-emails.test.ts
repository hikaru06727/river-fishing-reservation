import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAdminReservationCancelledEmail,
  buildCustomerReservationCancelledEmail,
  formatCancelledByLabel,
  sendReservationCancelledEmails,
  type ReservationCancelledEmailContext,
} from "@/lib/email/reservation-cancellation-emails";

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

vi.mock("@/lib/repositories/profiles.repository", () => ({
  findProfileEmailByUserIdAdmin: findProfileEmailMock,
}));

const baseContext: ReservationCancelledEmailContext = {
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
  cancelledBy: "customer",
  cancelledByLabel: "予約者本人",
};

describe("cancellation email content", () => {
  it("formatCancelledByLabel は実行者種別を返す", () => {
    expect(formatCancelledByLabel("customer")).toBe("予約者本人");
    expect(formatCancelledByLabel("admin")).toBe("全体管理者");
    expect(formatCancelledByLabel("business_admin")).toBe("担当事業管理者");
  });

  it("一般ユーザーキャンセル向けメール本文", () => {
    const email = buildCustomerReservationCancelledEmail(baseContext);

    expect(email.subject).toContain("【キャンセル完了】");
    expect(email.text).toContain("ご予約をキャンセルしました");
    expect(email.text).toContain("キャンセル実行者: 予約者本人");
    expect(email.text).toContain("テスト釣り場");
  });

  it("管理者キャンセル向けメール本文", () => {
    const email = buildCustomerReservationCancelledEmail({
      ...baseContext,
      cancelledBy: "admin",
      cancelledByLabel: "全体管理者",
    });

    expect(email.text).toContain("管理者によりご予約がキャンセルされました");
    expect(email.text).toContain("キャンセル実行者: 全体管理者");
  });

  it("business_admin キャンセル向けメール本文", () => {
    const email = buildCustomerReservationCancelledEmail({
      ...baseContext,
      cancelledBy: "business_admin",
      cancelledByLabel: "担当事業管理者",
    });

    expect(email.text).toContain("担当管理者によりご予約がキャンセルされました");
    expect(email.text).toContain("キャンセル実行者: 担当事業管理者");
  });

  it("buildAdminReservationCancelledEmail に予約者メールを含める", () => {
    const email = buildAdminReservationCancelledEmail(baseContext);

    expect(email.subject).toContain("【キャンセル通知】");
    expect(email.text).toContain("予約がキャンセルされました");
    expect(email.text).toContain("customer@example.com");
  });
});

describe("sendReservationCancelledEmails", () => {
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
      sendReservationCancelledEmails({
        reservationId: "res-123",
        customerUserId: "user-1",
        spotName: "テスト釣り場",
        businessId: "biz-1",
        planName: "半日プラン",
        reservationDate: "2026-06-20",
        startTime: "09:00:00",
        endTime: "13:00:00",
        guestCount: 2,
        cancelledBy: "customer",
      }),
    ).resolves.toBeUndefined();

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it("sendEmail 失敗時も throw しない", async () => {
    sendEmailMock.mockResolvedValue({ ok: false, error: "Resend error" });

    await expect(
      sendReservationCancelledEmails({
        reservationId: "res-123",
        customerUserId: "user-1",
        spotName: "テスト釣り場",
        businessId: "biz-1",
        planName: "半日プラン",
        reservationDate: "2026-06-20",
        startTime: "09:00:00",
        endTime: "13:00:00",
        guestCount: 2,
        cancelledBy: "admin",
      }),
    ).resolves.toBeUndefined();
  });

  it("予約者と管理者の両方に sendEmail を呼ぶ", async () => {
    await sendReservationCancelledEmails({
      reservationId: "res-123",
      customerUserId: "user-1",
      spotName: "テスト釣り場",
      businessId: "biz-1",
      planName: "半日プラン",
      reservationDate: "2026-06-20",
      startTime: "09:00:00",
      endTime: "13:00:00",
      guestCount: 2,
      cancelledBy: "business_admin",
    });

    expect(findProfileEmailMock).toHaveBeenCalledWith("user-1");
    expect(resolveRecipientsMock).toHaveBeenCalledWith("biz-1");
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(sendEmailMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "customer@example.com",
        subject: expect.stringContaining("【キャンセル完了】"),
      }),
    );
    expect(sendEmailMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: ["admin@example.com"],
        subject: expect.stringContaining("【キャンセル通知】"),
      }),
    );
  });
});

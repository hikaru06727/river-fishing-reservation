import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetResendClientForTests } from "@/lib/email/client";
import { getEmailSkipReason, isEmailsEnabled } from "@/lib/email/config";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("@/lib/email/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/client")>();
  return {
    ...actual,
    getResendClient: () => ({ emails: { send: sendMock } }),
  };
});

import { sendEmail } from "@/lib/email/send-email";

describe("email config", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("EMAILS_ENABLED=false のとき isEmailsEnabled は false", () => {
    process.env.EMAILS_ENABLED = "false";
    expect(isEmailsEnabled()).toBe(false);
    expect(getEmailSkipReason()).toBe("disabled");
  });

  it("EMAILS_ENABLED=true でも RESEND_API_KEY がなければ skip", () => {
    process.env.EMAILS_ENABLED = "true";
    delete process.env.RESEND_API_KEY;
    process.env.MAIL_FROM = "test@example.com";
    expect(getEmailSkipReason()).toBe("missing_api_key");
  });

  it("RESEND_API_KEY があっても MAIL_FROM がなければ skip", () => {
    process.env.EMAILS_ENABLED = "true";
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.MAIL_FROM;
    expect(getEmailSkipReason()).toBe("missing_from");
  });
});

describe("sendEmail", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    resetResendClientForTests();
    sendMock.mockReset();
  });

  afterEach(() => {
    process.env = env;
    resetResendClientForTests();
    sendMock.mockReset();
  });

  it("EMAILS_ENABLED=false のとき skipped で ok", async () => {
    process.env.EMAILS_ENABLED = "false";

    const result = await sendEmail({
      to: "user@example.com",
      subject: "test",
      text: "hello",
    });

    expect(result).toEqual({ ok: true, skipped: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("RESEND_API_KEY がないとき skipped で ok", async () => {
    process.env.EMAILS_ENABLED = "true";
    delete process.env.RESEND_API_KEY;
    process.env.MAIL_FROM = "from@example.com";

    const result = await sendEmail({
      to: "user@example.com",
      subject: "test",
      text: "hello",
    });

    expect(result).toEqual({ ok: true, skipped: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("text も html もないとき error", async () => {
    process.env.EMAILS_ENABLED = "true";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.MAIL_FROM = "from@example.com";

    const result = await sendEmail({
      to: "user@example.com",
      subject: "test",
    });

    expect(result).toEqual({
      ok: false,
      error: "Either text or html body is required.",
    });
  });

  it("設定済みのとき Resend API を呼ぶ", async () => {
    process.env.EMAILS_ENABLED = "true";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.MAIL_FROM = "River Fishing <onboarding@resend.dev>";

    sendMock.mockResolvedValue({
      data: { id: "email-123" },
      error: null,
    });

    const result = await sendEmail({
      to: "user@example.com",
      subject: "hello",
      text: "body",
    });

    expect(result).toEqual({ ok: true, id: "email-123" });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "hello",
        text: "body",
      }),
    );
  });
});

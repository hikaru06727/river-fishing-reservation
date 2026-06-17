import { afterEach, describe, expect, it } from "vitest";
import {
  getEmailConfigStatus,
  getEmailSkipMessage,
  getEmailSkipReason,
} from "@/lib/email/config";

describe("getEmailConfigStatus", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("全設定あり → ready", () => {
    process.env = {
      ...env,
      EMAILS_ENABLED: "true",
      RESEND_API_KEY: "re_test",
      MAIL_FROM: "test@example.com",
    };

    const status = getEmailConfigStatus();
    expect(status.ready).toBe(true);
    expect(status.skipReason).toBeNull();
  });

  it("EMAILS_ENABLED=false → disabled", () => {
    process.env = {
      ...env,
      EMAILS_ENABLED: "false",
      RESEND_API_KEY: "re_test",
      MAIL_FROM: "test@example.com",
    };

    expect(getEmailSkipReason()).toBe("disabled");
    expect(getEmailSkipMessage("disabled")).toContain("EMAILS_ENABLED");
  });
});

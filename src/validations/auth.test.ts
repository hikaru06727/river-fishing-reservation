import { describe, expect, it } from "vitest";
import {
  loginSchema,
  requestPasswordResetSchema,
  resendConfirmationSchema,
  signupSchema,
  updatePasswordSchema,
} from "./auth";

describe("loginSchema", () => {
  it("正しい入力を受理する", () => {
    const result = loginSchema.safeParse({
      email: "taro@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("メールアドレスが不正な場合は拒否する", () => {
    const result = loginSchema.safeParse({ email: "invalid", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("パスワードが空の場合は拒否する", () => {
    const result = loginSchema.safeParse({ email: "taro@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("パスワードとパスワード（確認）が一致すれば受理する", () => {
    const result = signupSchema.safeParse({
      email: "taro@example.com",
      password: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("パスワードとパスワード（確認）が不一致なら拒否する", () => {
    const result = signupSchema.safeParse({
      email: "taro@example.com",
      password: "password123",
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
  });

  it("8文字未満のパスワードは拒否する", () => {
    const result = signupSchema.safeParse({
      email: "taro@example.com",
      password: "short1",
      confirmPassword: "short1",
    });
    expect(result.success).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("パスワードとパスワード（確認）が一致すれば受理する", () => {
    const result = updatePasswordSchema.safeParse({
      password: "newpassword1",
      confirmPassword: "newpassword1",
    });
    expect(result.success).toBe(true);
  });

  it("不一致なら拒否する", () => {
    const result = updatePasswordSchema.safeParse({
      password: "newpassword1",
      confirmPassword: "newpassword2",
    });
    expect(result.success).toBe(false);
  });
});

describe("requestPasswordResetSchema", () => {
  it("正しいメールアドレスを受理する", () => {
    expect(requestPasswordResetSchema.safeParse({ email: "taro@example.com" }).success).toBe(true);
  });

  it("不正なメールアドレスは拒否する", () => {
    expect(requestPasswordResetSchema.safeParse({ email: "invalid" }).success).toBe(false);
  });
});

describe("resendConfirmationSchema", () => {
  it("正しいメールアドレスを受理する", () => {
    expect(resendConfirmationSchema.safeParse({ email: "taro@example.com" }).success).toBe(true);
  });
});

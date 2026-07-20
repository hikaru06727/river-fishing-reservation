"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  requestPasswordResetSchema,
  resendConfirmationSchema,
  signupSchema,
  updatePasswordSchema,
} from "@/validations/auth";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function loginRedirectPath(message: string, next?: string): string {
  const params = new URLSearchParams({ error: message });
  if (next) {
    params.set("next", next);
  }
  return `/login?${params.toString()}`;
}

function signupRedirectPath(message: string): string {
  return `/signup?error=${encodeURIComponent(message)}`;
}

function safeNextPath(next: string | undefined): string {
  return next && next.startsWith("/") ? next : "/my/reservations";
}

export async function login(formData: FormData) {
  const next = (formData.get("next") as string | null) ?? undefined;
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next,
  });

  if (!parsed.success) {
    redirect(loginRedirectPath(parsed.error.issues[0]?.message ?? "入力内容が正しくありません", next));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirect(
      loginRedirectPath(
        "メールアドレスまたはパスワードが正しくありません。パスワードを忘れた方は「パスワードをお忘れの方」からリセットしてください。",
        next,
      ),
    );
  }

  redirect(safeNextPath(next));
}

export async function signup(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect(signupRedirectPath(parsed.error.issues[0]?.message ?? "入力内容が正しくありません"));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent("/my/reservations")}`,
    },
  });

  if (error) {
    redirect(signupRedirectPath(error.message));
  }

  if (data.session) {
    // プロジェクト設定で email confirmation が無効な場合、signUp 直後にセッションが張られる
    redirect("/my/reservations");
  }

  redirect(`/login/sent?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function resendConfirmationEmail(formData: FormData) {
  const parsed = resendConfirmationSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    redirect(loginRedirectPath(parsed.error.issues[0]?.message ?? "入力内容が正しくありません"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent("/my/reservations")}`,
    },
  });

  if (error) {
    redirect(loginRedirectPath(`確認メールの再送に失敗しました: ${error.message}`));
  }

  redirect(`/login/sent?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    redirect(`/login/reset?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "入力内容が正しくありません")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent("/login/reset/confirm")}`,
  });

  if (error) {
    redirect(`/login/reset?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/login/reset/sent?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function updatePassword(formData: FormData) {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect(
      `/login/reset/confirm?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "入力内容が正しくありません")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      loginRedirectPath(
        "セッションの有効期限が切れています。お手数ですがもう一度パスワード再設定をお試しください。",
      ),
    );
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    redirect(`/login/reset/confirm?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/my/reservations");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

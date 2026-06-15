"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function loginRedirectPath(message: string): string {
  return `/login?error=${encodeURIComponent(message)}`;
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email) {
    redirect(loginRedirectPath("メールアドレスを入力してください"));
  }

  const supabase = await createClient();
  const next = (formData.get("next") as string) || "/my/reservations";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(loginRedirectPath(error.message));
  }

  redirect(`/login/sent?email=${encodeURIComponent(email)}`);
}

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email) {
    redirect(loginRedirectPath("メールアドレスを入力してください"));
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent("/my/reservations")}`,
    },
  });

  if (error) {
    redirect(loginRedirectPath(error.message));
  }

  redirect(`/login/sent?email=${encodeURIComponent(email)}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

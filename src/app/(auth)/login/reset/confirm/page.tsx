import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";
import { updatePassword } from "../../../actions";

export const metadata: Metadata = { title: "新しいパスワードの設定" };

export default async function PasswordResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const user = await getUser();
  if (!user) {
    redirect(
      "/login?" +
        new URLSearchParams({
          error: "リンクの有効期限が切れているか、無効です。お手数ですが再度パスワード再設定をお試しください。",
        }).toString(),
    );
  }

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">新しいパスワードの設定</h1>
        <p className="mt-2 text-sm text-muted">新しいパスワードを入力してください。</p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <form action={updatePassword} className="mt-8 space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              新しいパスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="8文字以上"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium">
              新しいパスワード（確認）
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="もう一度入力してください"
            />
          </div>
          <button
            type="submit"
            className="w-full min-h-12 rounded-full bg-primary font-semibold text-primary-foreground hover:opacity-90"
          >
            パスワードを設定する
          </button>
        </form>
      </div>
    </div>
  );
}

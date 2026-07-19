import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordReset } from "../../actions";

export const metadata: Metadata = { title: "パスワードの設定" };

export default async function PasswordResetRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">パスワードの設定</h1>
        <p className="mt-2 text-sm text-muted">
          登録済みのメールアドレスを入力してください。パスワード設定用のリンクをお送りします。
          <br />
          初めてログインする方も、こちらから初回パスワードを設定できます。
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <form action={requestPasswordReset} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            className="w-full min-h-12 rounded-full bg-primary font-semibold text-primary-foreground hover:opacity-90"
          >
            設定用リンクを送信
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="text-primary hover:underline"
          >
            ログイン画面に戻る
          </Link>
        </p>
      </div>
    </div>
  );
}

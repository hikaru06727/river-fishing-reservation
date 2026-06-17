import type { Metadata } from "next";
import Link from "next/link";
import { login } from "../actions";

export const metadata: Metadata = { title: "ログイン" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? params.redirect ?? "/my/reservations";

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">ログイン</h1>
        <p className="mt-2 text-sm text-muted">
          予約履歴の確認にはログインが必要です
        </p>

        {params.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {params.error}
          </p>
        )}

        <form action={login} className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next} />
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
            ログインリンクを送信
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          アカウントをお持ちでない方は{" "}
          <Link href="/signup" className="text-primary hover:underline">
            新規登録
          </Link>
        </p>

        <p className="mt-3 text-center text-sm text-muted">
          管理者の方は{" "}
          <Link href="/admin/login" className="text-primary hover:underline">
            管理者ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}

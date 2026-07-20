import type { Metadata } from "next";
import Link from "next/link";
import { login, resendConfirmationEmail } from "../actions";

export const metadata: Metadata = { title: "ログイン" };

const RESEND_ELIGIBLE_REASONS = new Set(["expired", "already_used", "browser_mismatch", "unknown"]);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; redirect?: string; error?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? params.redirect ?? "/my/reservations";
  const isReserveFlow = next.includes("/reserve/");
  const showResendForm = !!params.reason && RESEND_ELIGIBLE_REASONS.has(params.reason);

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">ログイン</h1>
        <p className="mt-2 text-sm text-muted">
          {isReserveFlow
            ? "予約を完了するにはログインが必要です"
            : "予約履歴の確認にはログインが必要です"}
        </p>

        {params.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {params.error}
          </p>
        )}

        {showResendForm && (
          <div className="mt-3 rounded-lg border border-border bg-slate-50 px-4 py-3">
            <p className="text-xs text-muted">
              新規登録の確認メールが届かない・リンクが無効だった場合は、メールアドレスを入力して再送してください。
            </p>
            <form action={resendConfirmationEmail} className="mt-2 flex gap-2">
              <input
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                className="min-h-10 flex-1 rounded-lg border border-border px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="min-h-10 shrink-0 rounded-lg border border-primary px-3 text-sm font-medium text-primary hover:bg-primary/5"
              >
                再送
              </button>
            </form>
          </div>
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
          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full min-h-12 rounded-full bg-primary font-semibold text-primary-foreground hover:opacity-90"
          >
            ログイン
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          パスワードをお忘れの方は{" "}
          <Link
            href={`/login/reset${next !== "/my/reservations" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-primary hover:underline"
          >
            こちら
          </Link>
        </p>

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

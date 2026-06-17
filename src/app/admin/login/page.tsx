import type { Metadata } from "next";
import Link from "next/link";
import { adminLogin } from "./actions";

export const metadata: Metadata = { title: "管理者ログイン" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/admin/reservations";

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">管理者ログイン</h1>
        <p className="mt-2 text-sm text-muted">
          管理画面へのアクセスにはメールアドレスとパスワードが必要です
        </p>

        {params.error && (
          <p
            className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {params.error}
          </p>
        )}

        <form action={adminLogin} className="mt-8 space-y-4">
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
              placeholder="admin@example.com"
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
            />
          </div>
          <button
            type="submit"
            className="w-full min-h-12 rounded-full bg-primary font-semibold text-primary-foreground hover:opacity-90"
          >
            ログイン
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          一般ユーザーの方は{" "}
          <Link href="/login" className="text-primary hover:underline">
            通常のログイン
          </Link>
        </p>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { signup } from "../actions";

export const metadata: Metadata = { title: "新規登録" };

export default function SignupPage() {
  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold">新規登録</h1>
        <p className="mt-2 text-sm text-muted">
          メールアドレスでアカウントを作成
        </p>

        <form action={signup} className="mt-8 space-y-4">
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
            登録リンクを送信
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-primary hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";

export default function ReserveNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-card px-6 py-12 text-center">
      <p className="text-5xl" aria-hidden="true">
        🎣
      </p>
      <h1 className="mt-4 text-xl font-bold">予約ページが見つかりません</h1>
      <p className="mt-2 text-sm text-muted">
        釣り場またはプランが存在しないか、URL が不正です。
      </p>
      <Link
        href="/spots"
        className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        釣り場一覧に戻る
      </Link>
    </div>
  );
}

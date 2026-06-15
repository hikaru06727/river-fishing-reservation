import Link from "next/link";

export default function SpotNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-card px-6 py-12 text-center">
      <p className="text-5xl" aria-hidden="true">
        🎣
      </p>
      <h1 className="mt-4 text-xl font-bold text-foreground">
        釣り場が見つかりません
      </h1>
      <p className="mt-2 text-sm text-muted">
        指定された釣り場は存在しないか、現在公開されていません。
      </p>
      <Link
        href="/spots"
        className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        釣り場一覧に戻る
      </Link>
    </div>
  );
}

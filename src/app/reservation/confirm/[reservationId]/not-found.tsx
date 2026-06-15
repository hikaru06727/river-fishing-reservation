import Link from "next/link";

export default function ConfirmNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-card px-6 py-12 text-center">
      <h1 className="text-xl font-bold">予約が見つかりません</h1>
      <p className="mt-2 text-sm text-muted">
        予約が存在しないか、アクセス権限がありません。
      </p>
      <Link
        href="/my/reservations"
        className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        マイ予約へ
      </Link>
    </div>
  );
}

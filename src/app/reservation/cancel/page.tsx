import Link from "next/link";

export default function ReservationCancelPage() {
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="text-5xl">❌</div>
      <h1 className="mt-4 text-2xl font-bold">決済がキャンセルされました</h1>
      <p className="mt-2 text-muted">予約は確定していません。再度お試しください。</p>
      <Link
        href="/spots"
        className="mt-6 inline-flex h-12 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground"
      >
        釣り場一覧へ戻る
      </Link>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { getUser } from "@/lib/auth/get-user";
import { getReservationById } from "@/lib/reservations/get-reservation";
import { formatDate, formatTime, formatYen } from "@/lib/utils/format";
import { formatDuration } from "@/lib/utils/plan";

interface ConfirmPageProps {
  params: Promise<{ reservationId: string }>;
}

export async function generateMetadata({ params }: ConfirmPageProps) {
  return { title: "予約確認" };
}

export default async function ReservationConfirmPage({ params }: ConfirmPageProps) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const { reservationId } = await params;
  const reservation = await getReservationById(reservationId, user.id);

  if (!reservation) {
    notFound();
  }

  const spotName = reservation.fishing_spots?.name ?? "—";
  const plan = reservation.plans;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        <p className="text-5xl" aria-hidden="true">
          ✅
        </p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          予約を受け付けました
        </h1>
        <p className="mt-2 text-sm text-muted">
          予約番号: <span className="font-mono text-xs">{reservation.id}</span>
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-muted">予約内容</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-muted">釣り場</dt>
            <dd className="text-right font-semibold">{spotName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-muted">プラン</dt>
            <dd className="text-right font-semibold">{plan?.name ?? "—"}</dd>
          </div>
          {plan && (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-muted">利用時間</dt>
              <dd className="text-right">{formatDuration(plan.duration_minutes)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-muted">利用日</dt>
            <dd className="text-right">{formatDate(reservation.reservation_date)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-muted">時間帯</dt>
            <dd className="text-right">
              {formatTime(reservation.start_time)} 〜 {formatTime(reservation.end_time)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-muted">参加人数</dt>
            <dd className="text-right">{reservation.guest_count} 名</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-3">
            <dt className="shrink-0 text-muted">合計金額</dt>
            <dd className="text-right text-lg font-bold text-primary">
              {formatYen(reservation.total_amount_yen)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-muted">ステータス</dt>
            <dd className="text-right">
              <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                仮予約（決済待ち）
              </span>
            </dd>
          </div>
        </dl>
      </Card>

      {reservation.expires_at && (
        <p className="text-center text-xs text-muted">
          決済期限:{" "}
          {new Date(reservation.expires_at).toLocaleString("ja-JP")}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Link
          href="/my/reservations"
          className="flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          マイ予約を見る
        </Link>
        {reservation.fishing_spots?.slug && (
          <Link
            href={`/spots/${reservation.fishing_spots.slug}`}
            className="text-center text-sm text-muted hover:text-primary"
          >
            釣り場詳細に戻る
          </Link>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProceedToCheckoutButton } from "@/components/reservation/ProceedToCheckoutButton";
import {
  buildReservationPaymentInfo,
  ReservationPaymentSummary,
} from "@/components/reservation/ReservationPaymentSummary";
import { Card } from "@/components/ui/Card";
import { ReservationStatusBadge } from "@/components/admin/ReservationStatusBadge";
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
  const paymentInfo = buildReservationPaymentInfo(reservation);
  const isOnlinePending =
    paymentInfo.paymentMethod === "online" && reservation.status === "pending";
  const isCashConfirmed =
    paymentInfo.paymentMethod === "cash_at_venue" && reservation.status === "confirmed";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        <p className="text-5xl" aria-hidden="true">
          {isOnlinePending ? "💳" : "✅"}
        </p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          {isOnlinePending
            ? "仮予約を受け付けました"
            : isCashConfirmed
              ? "予約が確定しました"
              : "予約を受け付けました"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          予約番号: <span className="font-mono text-xs">{reservation.id}</span>
        </p>
        {isOnlinePending ? (
          <p className="mt-3 text-sm text-foreground">
            続いてカード決済をお願いします。決済完了後に予約が確定します。
          </p>
        ) : isCashConfirmed ? (
          <p className="mt-3 text-sm text-foreground">
            当日、現地受付にて現金でお支払いください。
          </p>
        ) : (
          <p className="mt-3 text-sm text-foreground">予約内容をご確認ください。</p>
        )}
      </div>

      {isCashConfirmed && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="text-sm font-semibold text-amber-900">当日現金精算</h2>
          <p className="mt-2 text-sm text-amber-800">
            合計 {formatYen(reservation.total_amount_yen)} を、利用当日の受付にて現金でお支払いください。
            事前のカード決済は不要です。
          </p>
          <p className="mt-2 text-xs text-amber-700">
            内容はマイ予約からいつでもご確認いただけます。メール通知は設定されている場合に送信されます。
          </p>
        </Card>
      )}

      {isOnlinePending && (
        <Card className="border-sky-200 bg-sky-50">
          <h2 className="text-sm font-semibold text-sky-900">次のステップ：カード決済</h2>
          <p className="mt-2 text-sm text-sky-800">
            下のボタンから Stripe の安全な決済ページへ進んでください。
            決済が完了するまで予約は確定しません。
          </p>
          <div className="mt-4">
            <ProceedToCheckoutButton reservationId={reservation.id} />
          </div>
          {reservation.expires_at && (
            <p className="mt-3 text-center text-xs text-sky-700">
              決済期限: {new Date(reservation.expires_at).toLocaleString("ja-JP")}
              <br />
              期限を過ぎると予約は自動的にキャンセルされます。
            </p>
          )}
        </Card>
      )}

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
            <dt className="shrink-0 text-muted">予約状態</dt>
            <dd className="text-right">
              <ReservationStatusBadge status={reservation.status} />
            </dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-border pt-4">
          <ReservationPaymentSummary {...paymentInfo} layout="stack" />
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <Link
          href="/my/reservations"
          className="flex h-11 items-center justify-center rounded-lg border border-border text-sm font-semibold hover:bg-slate-50"
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

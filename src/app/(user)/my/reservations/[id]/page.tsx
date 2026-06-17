import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CancelReservationButton } from "@/components/reservation/CancelReservationButton";
import { ProceedToCheckoutButton } from "@/components/reservation/ProceedToCheckoutButton";
import {
  buildReservationPaymentInfo,
  ReservationPaymentSummary,
} from "@/components/reservation/ReservationPaymentSummary";
import { Card } from "@/components/ui/Card";
import { ReservationStatusBadge } from "@/components/admin/ReservationStatusBadge";
import { getUser } from "@/lib/auth/get-user";
import {
  canCancelReservation,
} from "@/lib/reservations/get-my-reservations";
import { getReservationById } from "@/lib/reservations/get-reservation";
import { shouldProceedToStripeCheckout } from "@/lib/reservations/payment-method";
import { formatDate, formatTime, formatYen } from "@/lib/utils/format";
import { formatDuration } from "@/lib/utils/plan";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface ReservationDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ReservationDetailPageProps) {
  return { title: "予約詳細" };
}

export default async function ReservationDetailPage({
  params,
}: ReservationDetailPageProps) {
  const user = await getUser();
  if (!user) {
    redirect("/login?next=/my/reservations");
  }

  const { id } = await params;
  const reservation = await getReservationById(id, user.id);

  if (!reservation) {
    notFound();
  }

  const spotName = reservation.fishing_spots?.name ?? "—";
  const plan = reservation.plans;
  const cancelPolicy = canCancelReservation({
    status: reservation.status,
    reservationDate: reservation.reservation_date,
    startTime: reservation.start_time,
  });
  const paymentInfo = buildReservationPaymentInfo(reservation);
  const showCheckout =
    reservation.status === "pending" &&
    shouldProceedToStripeCheckout(paymentInfo.paymentMethod);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/my/reservations"
          className="text-sm text-muted hover:text-primary"
        >
          ← マイ予約に戻る
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-foreground">予約詳細</h1>
        <p className="mt-1 font-mono text-xs text-muted">{reservation.id}</p>
      </header>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">{spotName}</h2>
            <p className="mt-0.5 text-sm text-muted">{plan?.name ?? "—"}</p>
          </div>
          <ReservationStatusBadge status={reservation.status} />
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          {plan && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">利用時間</dt>
              <dd>{formatDuration(plan.duration_minutes)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted">利用日</dt>
            <dd className="font-medium">{formatDate(reservation.reservation_date)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">時間帯</dt>
            <dd className="font-medium">
              {formatTime(reservation.start_time)} 〜 {formatTime(reservation.end_time)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">参加人数</dt>
            <dd className="font-medium">{reservation.guest_count} 名</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-3">
            <dt className="text-muted">合計金額</dt>
            <dd className="text-lg font-bold text-primary">
              {formatYen(reservation.total_amount_yen)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-border pt-4">
          <ReservationPaymentSummary
            paymentMethodLabel={paymentInfo.paymentMethodLabel}
            paymentStateLabel={paymentInfo.paymentStateLabel}
            paymentStateColor={paymentInfo.paymentStateColor}
          />
        </div>

        {showCheckout && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-3 text-sm text-muted">
              カード決済が完了すると予約が確定します。
            </p>
            <ProceedToCheckoutButton reservationId={reservation.id} />
          </div>
        )}

        {cancelPolicy.allowed ? (
          <div className="mt-6 border-t border-border pt-4">
            <CancelReservationButton reservationId={reservation.id} />
          </div>
        ) : (
          cancelPolicy.reason && (
            <p className="mt-6 border-t border-border pt-4 text-sm text-muted">
              {cancelPolicy.reason}
            </p>
          )
        )}
      </Card>

      {reservation.fishing_spots?.slug && (
        <Link
          href={`/spots/${reservation.fishing_spots.slug}`}
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          釣り場詳細を見る
        </Link>
      )}
    </div>
  );
}

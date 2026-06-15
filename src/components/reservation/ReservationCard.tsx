import Link from "next/link";
import { CancelReservationButton } from "@/components/reservation/CancelReservationButton";
import { Card } from "@/components/ui/Card";
import {
  canCancelReservation,
  getReservationStatusColor,
  getReservationStatusLabel,
  type MyReservation,
} from "@/lib/reservations/get-my-reservations";
import { formatDate, formatTime, formatYen } from "@/lib/utils/format";

interface ReservationCardProps {
  reservation: MyReservation;
}

export function ReservationCard({ reservation }: ReservationCardProps) {
  const spotName = reservation.fishing_spots?.name ?? "—";
  const planName = reservation.plans?.name ?? "—";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground">{spotName}</h2>
          <p className="mt-0.5 text-sm text-muted">{planName}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${getReservationStatusColor(reservation.status)}`}
        >
          {getReservationStatusLabel(reservation.status)}
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">利用日</dt>
          <dd className="font-medium">{formatDate(reservation.reservation_date)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">時間帯</dt>
          <dd className="font-medium">
            {formatTime(reservation.start_time)} 〜 {formatTime(reservation.end_time)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">参加人数</dt>
          <dd className="font-medium">{reservation.guest_count} 名</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2">
          <dt className="text-muted">合計金額</dt>
          <dd className="font-bold text-primary">
            {formatYen(reservation.total_amount_yen)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {reservation.fishing_spots?.slug && (
          <Link
            href={`/spots/${reservation.fishing_spots.slug}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            釣り場詳細を見る
          </Link>
        )}
        {canCancelReservation(reservation.status) && (
          <CancelReservationButton reservationId={reservation.id} />
        )}
      </div>
    </Card>
  );
}

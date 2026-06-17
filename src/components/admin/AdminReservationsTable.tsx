import Link from "next/link";
import { AdminCancelReservationButton } from "@/components/admin/AdminCancelReservationButton";
import { PaymentStatusBadge } from "@/components/admin/PaymentStatusBadge";
import { ReservationStatusBadge } from "@/components/admin/ReservationStatusBadge";
import { canCancelReservation } from "@/lib/reservations/get-my-reservations";
import type { AdminReservationRow } from "@/lib/reservations/get-admin-reservations";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils/format";

interface AdminReservationsTableProps {
  reservations: AdminReservationRow[];
  returnTo?: string;
}

export function AdminReservationsTable({
  reservations,
  returnTo = "/admin/reservations",
}: AdminReservationsTableProps) {
  if (reservations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted">
        条件に一致する予約がありません。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="border-b border-border bg-slate-50 text-xs text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">予約ID</th>
            <th className="px-4 py-3 font-medium">利用日時</th>
            <th className="px-4 py-3 font-medium">釣り場</th>
            <th className="px-4 py-3 font-medium">プラン</th>
            <th className="px-4 py-3 font-medium">予約者</th>
            <th className="px-4 py-3 font-medium">人数</th>
            <th className="px-4 py-3 font-medium">ステータス</th>
            <th className="px-4 py-3 font-medium">決済</th>
            <th className="px-4 py-3 font-medium">作成日時</th>
            <th className="px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {reservations.map((reservation) => {
            const cancelPolicy = canCancelReservation({
              status: reservation.status,
              reservationDate: reservation.reservation_date,
              startTime: reservation.start_time,
              isAdmin: true,
            });

            const detailHref = `/admin/reservations/${reservation.id}`;

            return (
              <tr key={reservation.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={detailHref} className="text-primary hover:underline">
                    {reservation.id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={detailHref} className="hover:text-primary">
                    {formatDate(reservation.reservation_date)}{" "}
                    {formatTime(reservation.start_time)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {reservation.fishing_spots?.name ?? "—"}
                </td>
                <td className="px-4 py-3">{reservation.plans?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <div>{reservation.profiles?.full_name || "—"}</div>
                  <div className="text-xs text-muted">
                    {reservation.profiles?.email ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3">{reservation.guest_count} 名</td>
                <td className="px-4 py-3">
                  <ReservationStatusBadge status={reservation.status} />
                </td>
                <td className="px-4 py-3">
                  <PaymentStatusBadge status={reservation.payment_status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {formatDateTime(reservation.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Link
                      href={detailHref}
                      className="text-xs text-primary hover:underline"
                    >
                      詳細
                    </Link>
                    {cancelPolicy.allowed ? (
                      <AdminCancelReservationButton
                        reservationId={reservation.id}
                        returnTo={returnTo}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

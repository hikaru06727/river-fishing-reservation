import { AdminCancelReservationButton } from "@/components/admin/AdminCancelReservationButton";
import {
  canCancelReservation,
  getReservationStatusColor,
  getReservationStatusLabel,
} from "@/lib/reservations/get-my-reservations";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils/format";
import type { AdminReservationRow } from "@/lib/reservations/get-admin-reservations";

interface AdminReservationsTableProps {
  reservations: AdminReservationRow[];
}

export function AdminReservationsTable({ reservations }: AdminReservationsTableProps) {
  if (reservations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted">
        条件に一致する予約がありません。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="border-b border-border bg-slate-50 text-xs text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">予約ID</th>
            <th className="px-4 py-3 font-medium">利用日</th>
            <th className="px-4 py-3 font-medium">開始時間</th>
            <th className="px-4 py-3 font-medium">ユーザー名</th>
            <th className="px-4 py-3 font-medium">メール</th>
            <th className="px-4 py-3 font-medium">プラン</th>
            <th className="px-4 py-3 font-medium">人数</th>
            <th className="px-4 py-3 font-medium">ステータス</th>
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

            return (
              <tr key={reservation.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {reservation.id.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatDate(reservation.reservation_date)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatTime(reservation.start_time)}
                </td>
                <td className="px-4 py-3">
                  {reservation.profiles?.full_name || "—"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {reservation.profiles?.email ?? "—"}
                </td>
                <td className="px-4 py-3">{reservation.plans?.name ?? "—"}</td>
                <td className="px-4 py-3">{reservation.guest_count} 名</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getReservationStatusColor(reservation.status)}`}
                  >
                    {getReservationStatusLabel(reservation.status)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {formatDateTime(reservation.created_at)}
                </td>
                <td className="px-4 py-3">
                  {cancelPolicy.allowed ? (
                    <AdminCancelReservationButton reservationId={reservation.id} />
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

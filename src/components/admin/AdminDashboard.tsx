import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ReservationStatusBadge } from "@/components/admin/ReservationStatusBadge";
import { getWeekDateRange } from "@/lib/reservations/admin-reservation-filters";
import type {
  AdminReservationRow,
  ManageableSpot,
  ReservationStatusCounts,
} from "@/lib/reservations/get-admin-reservations";
import { formatDate, formatTime } from "@/lib/utils/format";
import { toISODate } from "@/lib/utils/date";
import type { ReservationStatus } from "@/types/domain";

interface AdminDashboardProps {
  todayCount: number;
  statusCounts: ReservationStatusCounts;
  recentReservations: AdminReservationRow[];
  manageableSpots: ManageableSpot[];
  isAdmin: boolean;
}

const STATUS_ORDER: ReservationStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
  "expired",
];

const adminLinks = [
  { href: "/admin/reservations", label: "予約一覧", description: "全予約の検索・管理" },
  { href: "/admin/spots", label: "釣り場管理", description: "釣り場の設定" },
  { href: "/admin/slots", label: "空き枠管理", description: "枠の開閉・定員" },
  { href: "/admin/catches", label: "釣果管理", description: "釣果情報の投稿" },
  { href: "/admin/blog", label: "ブログ管理", description: "お知らせ・記事" },
];

export function AdminDashboard({
  todayCount,
  statusCounts,
  recentReservations,
  manageableSpots,
  isAdmin,
}: AdminDashboardProps) {
  const today = toISODate(new Date());
  const week = getWeekDateRange();

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-lg font-semibold text-foreground">ダッシュボード</h2>
        <p className="mt-1 text-sm text-muted">
          {isAdmin ? "全体の予約状況" : "担当事業の予約状況"}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-muted">今日の予約件数</p>
          <p className="mt-1 text-2xl font-bold">{todayCount} 件</p>
          <p className="mt-1 text-xs text-muted">{formatDate(today)}</p>
        </Card>
        {STATUS_ORDER.map((status) => (
          <Card key={status}>
            <p className="text-sm text-muted">
              <ReservationStatusBadge status={status} />
            </p>
            <p className="mt-2 text-2xl font-bold">{statusCounts[status]} 件</p>
            <Link
              href={`/admin/reservations?status=${status}`}
              className="mt-2 inline-block text-xs text-primary hover:underline"
            >
              一覧を見る
            </Link>
          </Card>
        ))}
      </section>

      <section className="flex flex-wrap gap-2">
        <Link
          href={`/admin/reservations?date=${today}`}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          今日の予約一覧
        </Link>
        <Link
          href={`/admin/reservations?dateFrom=${week.dateFrom}&dateTo=${week.dateTo}`}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          今週の予約一覧
        </Link>
        <Link
          href="/admin/reservations?status=pending"
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          仮予約（決済待ち）
        </Link>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">直近の予約</h3>
            <Link href="/admin/reservations" className="text-sm text-primary hover:underline">
              すべて見る
            </Link>
          </div>
          {recentReservations.length === 0 ? (
            <Card className="text-sm text-muted">予約がありません。</Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-slate-50 text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">利用日</th>
                    <th className="px-3 py-2 font-medium">釣り場</th>
                    <th className="px-3 py-2 font-medium">予約者</th>
                    <th className="px-3 py-2 font-medium">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentReservations.map((reservation) => (
                    <tr key={reservation.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link
                          href={`/admin/reservations/${reservation.id}`}
                          className="text-primary hover:underline"
                        >
                          {formatDate(reservation.reservation_date)}{" "}
                          {formatTime(reservation.start_time)}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        {reservation.locations?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {reservation.profiles?.full_name ||
                          reservation.profiles?.email ||
                          "—"}
                      </td>
                      <td className="px-3 py-2">
                        <ReservationStatusBadge status={reservation.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">
            {isAdmin ? "管理できる釣り場" : "担当釣り場"}
          </h3>
          {manageableSpots.length === 0 ? (
            <Card className="text-sm text-muted">操作可能な釣り場がありません。</Card>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {manageableSpots.map((spot) => (
                <li key={spot.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{spot.name}</p>
                    {!spot.is_active && (
                      <p className="text-xs text-amber-700">非公開</p>
                    )}
                  </div>
                  <Link
                    href={`/admin/reservations?spotId=${spot.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    予約を見る
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-foreground">管理メニュー</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-border bg-card p-4 hover:bg-slate-50"
            >
              <p className="font-medium text-foreground">{link.label}</p>
              <p className="mt-1 text-xs text-muted">{link.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

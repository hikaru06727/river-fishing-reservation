import { AdminReservationsTable } from "@/components/admin/AdminReservationsTable";
import { Pagination } from "@/components/admin/Pagination";
import { ReservationFilters } from "@/components/admin/ReservationFilters";
import { ReservationSummaryCards } from "@/components/admin/ReservationSummaryCards";
import { getManagementScope } from "@/lib/auth/management-access";
import {
  getAdminReservations,
  getTodayReservationSummary,
} from "@/lib/reservations/get-admin-reservations";
import { isAdminRole } from "@/lib/auth/role";
import type { ReservationStatus } from "@/types/database";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "予約管理",
};

interface AdminReservationsPageProps {
  searchParams: Promise<{
    date?: string;
    status?: string;
    page?: string;
  }>;
}

const VALID_STATUSES: Array<ReservationStatus | "all"> = [
  "all",
  "pending",
  "confirmed",
  "cancelled",
  "expired",
];

function parseStatus(value?: string): ReservationStatus | "all" {
  if (value && VALID_STATUSES.includes(value as ReservationStatus | "all")) {
    return value as ReservationStatus | "all";
  }
  return "all";
}

export default async function AdminReservationsPage({
  searchParams,
}: AdminReservationsPageProps) {
  const params = await searchParams;
  const date = params.date || undefined;
  const status = parseStatus(params.status);
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const [summary, result, scope] = await Promise.all([
    getTodayReservationSummary(),
    getAdminReservations({ date, status, page }),
    getManagementScope(),
  ]);

  const scopeDescription =
    scope && isAdminRole(scope.role)
      ? "全事業の予約"
      : scope && scope.businessNames && scope.businessNames.length > 0
        ? `担当事業: ${scope.businessNames.join("、")}`
        : scope
          ? "担当事業が未割当のため、操作可能な予約はありません"
          : "予約一覧";

  const filterParams = {
    date,
    status: status === "all" ? undefined : status,
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-foreground">予約管理</h2>
        <p className="mt-1 text-sm text-muted">
          {scopeDescription}（{result.totalCount} 件）
        </p>
      </header>

      <ReservationSummaryCards summary={summary} />

      <ReservationFilters date={date} status={status} />

      <AdminReservationsTable reservations={result.reservations} />

      <div className="flex flex-col items-center gap-2">
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          basePath="/admin/reservations"
          searchParams={filterParams}
        />
        <p className="text-xs text-muted">
          {result.totalCount} 件中 {(result.page - 1) * result.pageSize + 1}–
          {Math.min(result.page * result.pageSize, result.totalCount)} 件を表示
        </p>
      </div>
    </div>
  );
}

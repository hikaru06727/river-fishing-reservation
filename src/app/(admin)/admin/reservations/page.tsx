import { AdminReservationsTable } from "@/components/admin/AdminReservationsTable";
import { Pagination } from "@/components/admin/Pagination";
import { ReservationFilters } from "@/components/admin/ReservationFilters";
import { ReservationSummaryCards } from "@/components/admin/ReservationSummaryCards";
import { getManagementScope } from "@/lib/auth/management-access";
import {
  buildAdminReservationSearchParams,
  parseAdminReservationFilters,
} from "@/lib/reservations/admin-reservation-filters";
import {
  getAdminReservations,
  getManageableSpots,
  getTodayReservationSummary,
} from "@/lib/reservations/get-admin-reservations";
import { isAdminRole } from "@/lib/auth/role";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "予約管理",
};

interface AdminReservationsPageProps {
  searchParams: Promise<{
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    spotId?: string;
    page?: string;
  }>;
}

export default async function AdminReservationsPage({
  searchParams,
}: AdminReservationsPageProps) {
  const params = await searchParams;
  const filters = parseAdminReservationFilters(params);

  const [summary, result, scope, spots] = await Promise.all([
    getTodayReservationSummary(),
    getAdminReservations(filters),
    getManagementScope(),
    getManageableSpots(),
  ]);

  const scopeDescription =
    scope && isAdminRole(scope.role)
      ? "全事業の予約"
      : scope && scope.businessNames && scope.businessNames.length > 0
        ? `担当事業: ${scope.businessNames.join("、")}`
        : scope
          ? "担当事業が未割当のため、操作可能な予約はありません"
          : "予約一覧";

  const filterParams = buildAdminReservationSearchParams({
    date: filters.date,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    status: filters.status,
    spotId: filters.spotId,
  });

  const returnToQuery = new URLSearchParams(
    Object.entries(filterParams).filter((entry): entry is [string, string] => !!entry[1]),
  ).toString();
  const returnTo = returnToQuery
    ? `/admin/reservations?${returnToQuery}`
    : "/admin/reservations";

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-foreground">予約管理</h2>
        <p className="mt-1 text-sm text-muted">
          {scopeDescription}（{result.totalCount} 件）
        </p>
      </header>

      <ReservationSummaryCards summary={summary} />

      <ReservationFilters
        date={filters.date}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        status={filters.status}
        spotId={filters.spotId}
        spots={spots}
      />

      <AdminReservationsTable reservations={result.reservations} returnTo={returnTo} />

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

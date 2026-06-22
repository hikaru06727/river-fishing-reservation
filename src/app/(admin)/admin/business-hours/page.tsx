import { BusinessDayExceptionsPanel } from "@/components/admin/BusinessDayExceptionsPanel";
import { BusinessHoursSpotFilters } from "@/components/admin/BusinessHoursSpotFilters";
import { BusinessHoursWeeklyForm } from "@/components/admin/BusinessHoursWeeklyForm";
import { getManagementScope } from "@/lib/auth/management-access";
import { isAdminRole } from "@/lib/auth/role";
import {
  getBusinessHoursDataForSpot,
  getManageableBusinessesForBusinessHours,
  getSelectableSpotsForBusinessHours,
  parseAdminBusinessHoursFilters,
} from "@/lib/business-hours/get-admin-business-hours";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "営業時間設定",
};

interface AdminBusinessHoursPageProps {
  searchParams: Promise<{
    spotId?: string;
    businessId?: string;
  }>;
}

export default async function AdminBusinessHoursPage({
  searchParams,
}: AdminBusinessHoursPageProps) {
  const params = await searchParams;
  const filters = parseAdminBusinessHoursFilters(params);

  const [scope, spots, businesses, hoursData] = await Promise.all([
    getManagementScope(),
    getSelectableSpotsForBusinessHours(),
    getManageableBusinessesForBusinessHours(),
    filters.spotId ? getBusinessHoursDataForSpot(filters.spotId) : Promise.resolve(null),
  ]);

  const isAdmin = scope != null && isAdminRole(scope.role);
  const selectedSpot = filters.spotId
    ? spots.find((spot) => spot.id === filters.spotId)
    : undefined;

  const scopeDescription =
    scope && isAdmin
      ? "全釣り場の営業時間"
      : scope && scope.businessNames && scope.businessNames.length > 0
        ? `担当事業: ${scope.businessNames.join("、")}`
        : scope
          ? "担当事業が未割当のため、操作可能な釣り場はありません"
          : "営業時間設定";

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-foreground">営業時間設定</h2>
        <p className="mt-1 text-sm text-muted">{scopeDescription}</p>
      </header>

      <BusinessHoursSpotFilters
        businessId={filters.businessId}
        spotId={filters.spotId}
        businesses={businesses}
        spots={spots}
        showBusinessFilter={isAdmin}
      />

      {!filters.spotId && (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted">
          釣り場を選択して「表示」を押すと、曜日別営業時間と例外日を編集できます。
        </p>
      )}

      {filters.spotId && !selectedSpot && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          選択した釣り場を表示する権限がありません。
        </p>
      )}

      {filters.spotId && selectedSpot && hoursData && (
        <div className="space-y-6">
          <p className="text-sm text-foreground">
            編集中: <span className="font-semibold">{selectedSpot.name}</span>
          </p>
          <BusinessHoursWeeklyForm
            spotId={filters.spotId}
            weeklyHours={hoursData.weeklyHours}
          />
          <BusinessDayExceptionsPanel
            spotId={filters.spotId}
            exceptions={hoursData.exceptions}
          />
        </div>
      )}
    </div>
  );
}

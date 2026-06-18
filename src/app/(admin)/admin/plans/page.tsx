import Link from "next/link";
import { AdminPlansTable } from "@/components/admin/AdminPlansTable";
import { PlanFilters } from "@/components/admin/PlanFilters";
import { getManagementScope } from "@/lib/auth/management-access";
import { isAdminRole } from "@/lib/auth/role";
import {
  buildAdminPlanSearchParams,
  getAdminPlans,
  getManageableBusinessesForPlans,
  getManageableSpotsForPlans,
  parseAdminPlanFilters,
} from "@/lib/plans/get-admin-plans";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "プラン管理",
};

interface AdminPlansPageProps {
  searchParams: Promise<{
    spotId?: string;
    businessId?: string;
  }>;
}

export default async function AdminPlansPage({ searchParams }: AdminPlansPageProps) {
  const params = await searchParams;
  const filters = parseAdminPlanFilters(params);

  const [plans, scope, spots, businesses] = await Promise.all([
    getAdminPlans(filters),
    getManagementScope(),
    getManageableSpotsForPlans(),
    getManageableBusinessesForPlans(),
  ]);

  const isAdmin = scope != null && isAdminRole(scope.role);

  const scopeDescription =
    scope && isAdmin
      ? "全事業のプラン"
      : scope && scope.businessNames && scope.businessNames.length > 0
        ? `担当事業: ${scope.businessNames.join("、")}`
        : scope
          ? "担当事業が未割当のため、操作可能なプランはありません"
          : "プラン一覧";

  const filterParams = buildAdminPlanSearchParams(filters);
  const returnToQuery = new URLSearchParams(
    Object.entries(filterParams).filter((entry): entry is [string, string] => !!entry[1]),
  ).toString();
  const returnTo = returnToQuery ? `/admin/plans?${returnToQuery}` : "/admin/plans";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">プラン管理</h2>
          <p className="mt-1 text-sm text-muted">
            {scopeDescription}（{plans.length} 件）
          </p>
        </div>
        <Link
          href="/admin/plans/new"
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          新規作成
        </Link>
      </header>

      <PlanFilters
        businessId={filters.businessId}
        spotId={filters.spotId}
        businesses={businesses}
        spots={spots}
        showBusinessFilter={isAdmin}
      />

      <AdminPlansTable
        plans={plans}
        returnTo={returnTo}
        canEditGlobalPlans={isAdmin}
      />
    </div>
  );
}

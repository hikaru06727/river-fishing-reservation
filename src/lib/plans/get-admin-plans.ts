import { unstable_noStore as noStore } from "next/cache";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { isAdminRole } from "@/lib/auth/role";
import {
  findAssignedBusinessIdsByUserId,
  findManageableBusinesses,
  findManageableSpots,
} from "@/lib/repositories/businesses.repository";
import {
  findAdminPlans,
  type AdminPlanFilters,
  type AdminPlanRow,
} from "@/lib/repositories/plans.repository";
import {
  filterAdminPlansForProfile,
  filterSelectableSpotsForProfile,
} from "@/lib/plans/admin-plan-scope";

export type { AdminPlanRow, AdminPlanFilters };

export type AdminPlanListFilters = {
  spotId?: string;
  businessId?: string;
};

export function parseAdminPlanFilters(params: {
  spotId?: string;
  businessId?: string;
}): AdminPlanListFilters {
  return {
    spotId: params.spotId || undefined,
    businessId: params.businessId || undefined,
  };
}

export function buildAdminPlanSearchParams(
  filters: AdminPlanListFilters,
): Record<string, string | undefined> {
  return {
    spotId: filters.spotId,
    businessId: filters.businessId,
  };
}

async function getPlanManagementContext() {
  const session = await getAuthenticatedManagement();
  if (!session) {
    return null;
  }

  const assignedBusinessIds = isAdminRole(session.profile.role)
    ? []
    : await findAssignedBusinessIdsByUserId(session.profile.id);

  return {
    profile: session.profile,
    assignedBusinessIds,
  };
}

export async function getAdminPlans(
  filters: AdminPlanListFilters = {},
): Promise<AdminPlanRow[]> {
  noStore();

  const context = await getPlanManagementContext();
  if (!context) {
    return [];
  }

  const plans = await findAdminPlans(filters);
  return filterAdminPlansForProfile(
    plans,
    context.profile,
    context.assignedBusinessIds,
  );
}

/** プラン作成・編集・フィルタ用の選択可能釣り場（権限スコープ済み） */
export async function getSelectableSpotsForPlans() {
  noStore();

  const context = await getPlanManagementContext();
  if (!context) {
    return [];
  }

  const spots = await findManageableSpots();
  return filterSelectableSpotsForProfile(
    spots,
    context.profile,
    context.assignedBusinessIds,
  );
}

/** @deprecated getSelectableSpotsForPlans を使用 */
export const getManageableSpotsForPlans = getSelectableSpotsForPlans;

export async function getManageableBusinessesForPlans() {
  noStore();
  return findManageableBusinesses();
}

import { unstable_noStore as noStore } from "next/cache";
import {
  findManageableBusinesses,
  findManageableSpots,
} from "@/lib/repositories/businesses.repository";
import {
  findAdminPlans,
  type AdminPlanFilters,
  type AdminPlanRow,
} from "@/lib/repositories/plans.repository";

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

export async function getAdminPlans(
  filters: AdminPlanListFilters = {},
): Promise<AdminPlanRow[]> {
  noStore();
  return findAdminPlans(filters);
}

export async function getManageableSpotsForPlans() {
  noStore();
  return findManageableSpots();
}

export async function getManageableBusinessesForPlans() {
  noStore();
  return findManageableBusinesses();
}

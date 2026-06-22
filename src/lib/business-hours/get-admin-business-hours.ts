import { unstable_noStore as noStore } from "next/cache";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { isAdminRole } from "@/lib/auth/role";
import {
  findAssignedBusinessIdsByUserId,
  findManageableBusinesses,
  findManageableSpots,
} from "@/lib/repositories/businesses.repository";
import {
  findDateExceptionsBySpotId,
  findWeeklyHoursBySpotId,
} from "@/lib/repositories/business-hours.repository";
import {
  findExceptionBreaksByExceptionId,
  findWeeklyBreaksBySpotId,
} from "@/lib/repositories/business-breaks.repository";
import { filterSelectableSpotsForProfile } from "@/lib/plans/admin-plan-scope";
import type {
  FishingSpotDateException,
  FishingSpotExceptionBreak,
  FishingSpotWeeklyBreak,
  FishingSpotWeeklyHour,
} from "@/types/database";

export type AdminBusinessHoursFilters = {
  spotId?: string;
  businessId?: string;
};

export function parseAdminBusinessHoursFilters(params: {
  spotId?: string;
  businessId?: string;
}): AdminBusinessHoursFilters {
  return {
    spotId: params.spotId || undefined,
    businessId: params.businessId || undefined,
  };
}

async function getManagementContext() {
  const session = await getAuthenticatedManagement();
  if (!session) {
    return null;
  }

  const assignedBusinessIds = isAdminRole(session.profile.role)
    ? []
    : await findAssignedBusinessIdsByUserId(session.profile.id);

  return { session, assignedBusinessIds };
}

export async function getSelectableSpotsForBusinessHours() {
  noStore();
  const context = await getManagementContext();
  if (!context) {
    return [];
  }

  const spots = await findManageableSpots();
  return filterSelectableSpotsForProfile(
    spots,
    context.session.profile,
    context.assignedBusinessIds,
  );
}

export async function getManageableBusinessesForBusinessHours() {
  noStore();
  const context = await getManagementContext();
  if (!context || !isAdminRole(context.session.profile.role)) {
    return [];
  }

  return findManageableBusinesses();
}

export async function getBusinessHoursDataForSpot(spotId: string): Promise<{
  weeklyHours: FishingSpotWeeklyHour[];
  weeklyBreaks: FishingSpotWeeklyBreak[];
  exceptions: FishingSpotDateException[];
  exceptionBreaksByExceptionId: Record<string, FishingSpotExceptionBreak[]>;
} | null> {
  noStore();
  const context = await getManagementContext();
  if (!context) {
    return null;
  }

  const spots = await getSelectableSpotsForBusinessHours();
  if (!spots.some((spot) => spot.id === spotId)) {
    return null;
  }

  const [weeklyHours, weeklyBreaks, exceptions] = await Promise.all([
    findWeeklyHoursBySpotId(spotId),
    findWeeklyBreaksBySpotId(spotId),
    findDateExceptionsBySpotId(spotId),
  ]);

  const exceptionBreaksEntries = await Promise.all(
    exceptions.map(async (exception) => {
      const breaks = await findExceptionBreaksByExceptionId(exception.id);
      return [exception.id, breaks] as const;
    }),
  );

  const exceptionBreaksByExceptionId = Object.fromEntries(exceptionBreaksEntries);

  return { weeklyHours, weeklyBreaks, exceptions, exceptionBreaksByExceptionId };
}

import {
  canManagePlanForProfile,
  canManageSpotForProfile,
} from "@/lib/auth/management-access";
import { isAdminRole, isBusinessAdminRole } from "@/lib/auth/role";
import type { AdminPlanRow } from "@/lib/repositories/plans.repository";
import type { ManageableSpotRow } from "@/lib/repositories/businesses.repository";
import type { Profile } from "@/types/database";

/** business_admin 向けに担当 spot のみ残す（admin は全件） */
export function filterSelectableSpotsForProfile(
  spots: readonly ManageableSpotRow[],
  profile: Pick<Profile, "role" | "id">,
  assignedBusinessIds: readonly string[],
): ManageableSpotRow[] {
  if (isAdminRole(profile.role)) {
    return [...spots];
  }
  if (!isBusinessAdminRole(profile.role)) {
    return [];
  }
  return spots.filter((spot) =>
    canManageSpotForProfile(profile, spot.business_id, assignedBusinessIds),
  );
}

/** business_admin 向けに担当 spot のプランのみ残す（admin は全件） */
export function filterAdminPlansForProfile(
  plans: readonly AdminPlanRow[],
  profile: Pick<Profile, "role" | "id">,
  assignedBusinessIds: readonly string[],
): AdminPlanRow[] {
  if (isAdminRole(profile.role)) {
    return [...plans];
  }
  if (!isBusinessAdminRole(profile.role)) {
    return [];
  }
  return plans.filter((plan) =>
    canManagePlanForProfile(
      profile,
      plan.fishing_spot_id,
      plan.fishing_spots?.business_id ?? null,
      assignedBusinessIds,
    ),
  );
}

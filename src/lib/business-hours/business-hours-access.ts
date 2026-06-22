import { canManageSpotForProfile } from "@/lib/auth/management-access";
import { isAdminRole, isBusinessAdminRole } from "@/lib/auth/role";
import type { Profile } from "@/types/database";

/** 純粋関数: spot の営業時間設定操作可否 */
export function canManageBusinessHoursForProfile(
  profile: Pick<Profile, "role" | "id"> | null | undefined,
  spotBusinessId: string | null | undefined,
  assignedBusinessIds: readonly string[],
): boolean {
  if (!profile) {
    return false;
  }
  if (isAdminRole(profile.role)) {
    return true;
  }
  if (!isBusinessAdminRole(profile.role)) {
    return false;
  }
  return canManageSpotForProfile(profile, spotBusinessId, assignedBusinessIds);
}

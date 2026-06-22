import {
  findAssignedBusinessIdsByUserId,
  findBusinessNamesByIds,
  findReservationSpotIdByReservationId,
  findSpotBusinessIdBySpotId,
} from "@/lib/repositories/businesses.repository";
import { findPlanSpotIdByPlanId } from "@/lib/repositories/plans.repository";
import { getProfile, getUser } from "@/lib/auth/get-user";
import { isAdminRole, isBusinessAdminRole } from "@/lib/auth/role";
import type { Profile, UserRole } from "@/types/database";

export type ManagementScope = {
  role: UserRole;
  /** admin のとき null（全事業） */
  businessNames: string[] | null;
};

/** 純粋関数: profiles.role + 割当事業 ID で business 操作可否 */
export function canManageBusinessForProfile(
  profile: Pick<Profile, "role" | "id"> | null | undefined,
  businessId: string,
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
  return assignedBusinessIds.includes(businessId);
}

/** 純粋関数: spot の business_id 経由で spot 操作可否 */
export function canManageSpotForProfile(
  profile: Pick<Profile, "role" | "id"> | null | undefined,
  spotBusinessId: string | null | undefined,
  assignedBusinessIds: readonly string[],
): boolean {
  if (!profile || !spotBusinessId) {
    return false;
  }
  return canManageBusinessForProfile(profile, spotBusinessId, assignedBusinessIds);
}

/** 純粋関数: reservation の spot → business 経由で予約操作可否 */
export function canManageReservationForProfile(
  profile: Pick<Profile, "role" | "id"> | null | undefined,
  spotBusinessId: string | null | undefined,
  assignedBusinessIds: readonly string[],
): boolean {
  return canManageSpotForProfile(profile, spotBusinessId, assignedBusinessIds);
}

/** 純粋関数: plan の location_id 経由でプラン操作可否 */
export function canManagePlanForProfile(
  profile: Pick<Profile, "role" | "id"> | null | undefined,
  planSpotId: string | null | undefined,
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
  if (!planSpotId) {
    return false;
  }
  return canManageSpotForProfile(profile, spotBusinessId, assignedBusinessIds);
}

export async function canCurrentUserManagePlan(
  planId: string | null | undefined,
): Promise<boolean> {
  if (!planId) {
    return false;
  }

  const profile = await getManagementProfile();
  if (!profile) {
    return false;
  }
  if (isAdminRole(profile.role)) {
    return true;
  }
  if (!isBusinessAdminRole(profile.role)) {
    return false;
  }

  let spotId: string | null;
  try {
    spotId = await findPlanSpotIdByPlanId(planId);
  } catch (error) {
    console.error(
      "[canCurrentUserManagePlan]",
      error instanceof Error ? error.message : error,
    );
    return false;
  }

  if (!spotId) {
    return false;
  }

  let spotBusinessId: string | null;
  try {
    spotBusinessId = await findSpotBusinessIdBySpotId(spotId);
  } catch (error) {
    console.error(
      "[canCurrentUserManagePlan]",
      error instanceof Error ? error.message : error,
    );
    return false;
  }

  const assignedIds = await getAssignedBusinessIds(profile.id);
  return canManagePlanForProfile(profile, spotId, spotBusinessId, assignedIds);
}

async function getAssignedBusinessIds(userId: string): Promise<string[]> {
  try {
    return await findAssignedBusinessIdsByUserId(userId);
  } catch (error) {
    console.error(
      "[getAssignedBusinessIds]",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function getManagementProfile(): Promise<Profile | null> {
  const user = await getUser();
  if (!user) {
    return null;
  }
  return getProfile();
}

export async function canCurrentUserManageBusiness(
  businessId: string | null | undefined,
): Promise<boolean> {
  if (!businessId) {
    return false;
  }

  const profile = await getManagementProfile();
  if (!profile) {
    return false;
  }
  if (isAdminRole(profile.role)) {
    return true;
  }
  if (!isBusinessAdminRole(profile.role)) {
    return false;
  }

  const assignedIds = await getAssignedBusinessIds(profile.id);
  return canManageBusinessForProfile(profile, businessId, assignedIds);
}

export async function canCurrentUserManageSpot(
  spotId: string | null | undefined,
): Promise<boolean> {
  if (!spotId) {
    return false;
  }

  const profile = await getManagementProfile();
  if (!profile) {
    return false;
  }
  if (isAdminRole(profile.role)) {
    return true;
  }
  if (!isBusinessAdminRole(profile.role)) {
    return false;
  }

  let spotBusinessId: string | null;
  try {
    spotBusinessId = await findSpotBusinessIdBySpotId(spotId);
  } catch (error) {
    console.error(
      "[canCurrentUserManageSpot]",
      error instanceof Error ? error.message : error,
    );
    return false;
  }

  const assignedIds = await getAssignedBusinessIds(profile.id);
  return canManageSpotForProfile(profile, spotBusinessId, assignedIds);
}

export async function canCurrentUserManageReservation(
  reservationId: string | null | undefined,
): Promise<boolean> {
  if (!reservationId) {
    return false;
  }

  const profile = await getManagementProfile();
  if (!profile) {
    return false;
  }
  if (isAdminRole(profile.role)) {
    return true;
  }
  if (!isBusinessAdminRole(profile.role)) {
    return false;
  }

  let spotId: string | null;
  try {
    spotId = await findReservationSpotIdByReservationId(reservationId);
  } catch (error) {
    console.error(
      "[canCurrentUserManageReservation]",
      error instanceof Error ? error.message : error,
    );
    return false;
  }

  if (!spotId) {
    return false;
  }

  return canCurrentUserManageSpot(spotId);
}

/** 管理画面の簡易表示用（business_admin は担当事業名を返す） */
export async function getManagementScope(): Promise<ManagementScope | null> {
  const profile = await getManagementProfile();
  if (!profile || (!isAdminRole(profile.role) && !isBusinessAdminRole(profile.role))) {
    return null;
  }

  if (isAdminRole(profile.role)) {
    return { role: profile.role, businessNames: null };
  }

  const assignedIds = await getAssignedBusinessIds(profile.id);
  if (assignedIds.length === 0) {
    return { role: profile.role, businessNames: [] };
  }

  try {
    const businessNames = await findBusinessNamesByIds(assignedIds);
    return { role: profile.role, businessNames };
  } catch (error) {
    console.error("[getManagementScope]", error instanceof Error ? error.message : error);
    return { role: profile.role, businessNames: [] };
  }
}

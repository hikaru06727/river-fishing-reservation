import { createClient } from "@/lib/supabase/server";
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

async function getAssignedBusinessIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_admin_assignments")
    .select("business_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[getAssignedBusinessIds]", error.message);
    return [];
  }

  return (data ?? []).map((row) => row.business_id);
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

  const supabase = await createClient();
  const { data: spot, error } = await supabase
    .from("fishing_spots")
    .select("business_id")
    .eq("id", spotId)
    .maybeSingle();

  if (error) {
    console.error("[canCurrentUserManageSpot]", error.message);
    return false;
  }

  const assignedIds = await getAssignedBusinessIds(profile.id);
  return canManageSpotForProfile(profile, spot?.business_id ?? null, assignedIds);
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

  const supabase = await createClient();
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("spot_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    console.error("[canCurrentUserManageReservation]", error.message);
    return false;
  }

  if (!reservation) {
    return false;
  }

  return canCurrentUserManageSpot(reservation.spot_id);
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

  const supabase = await createClient();
  const assignedIds = await getAssignedBusinessIds(profile.id);
  if (assignedIds.length === 0) {
    return { role: profile.role, businessNames: [] };
  }

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("name")
    .in("id", assignedIds)
    .order("name");

  if (error) {
    console.error("[getManagementScope]", error.message);
    return { role: profile.role, businessNames: [] };
  }

  return {
    role: profile.role,
    businessNames: (businesses ?? []).map((b) => b.name),
  };
}

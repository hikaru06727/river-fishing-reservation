import type { Profile, AppUserRole, UserRole } from "@/types/database";

/** DB / RLS と一致させるロール定数 */
export const APP_USER_ROLES = ["user", "admin", "business_admin", "staff"] as const satisfies readonly AppUserRole[];

/** DB profiles.role CHECK 制約と一致 */
export const DB_USER_ROLES = ["user", "admin", "business_admin", "staff"] as const satisfies readonly UserRole[];

export function getRoleFromProfile(
  profile: Pick<Profile, "role"> | null | undefined,
): UserRole | undefined {
  return profile?.role;
}

export function isAdminRole(role: AppUserRole | string | null | undefined): boolean {
  return role === "admin";
}

export function isBusinessAdminRole(role: AppUserRole | string | null | undefined): boolean {
  return role === "business_admin";
}

export function isStaffRole(role: AppUserRole | string | null | undefined): boolean {
  return role === "staff";
}

export function isAdminProfile(profile: Pick<Profile, "role"> | null | undefined): boolean {
  return isAdminRole(profile?.role);
}

/** 管理画面に入れるロール */
export function isManagementRole(role: AppUserRole | string | null | undefined): boolean {
  return isAdminRole(role) || isBusinessAdminRole(role) || isStaffRole(role);
}

export function isManagementProfile(
  profile: Pick<Profile, "role"> | null | undefined,
): boolean {
  return isManagementRole(profile?.role);
}

export function hasRole(
  profile: Pick<Profile, "role"> | null | undefined,
  role: AppUserRole,
): boolean {
  return profile?.role === role;
}

import {
  findUnresolvedAddonCleanupIssuesByBusinessId,
  markAddonCleanupIssueResolved,
} from "@/lib/repositories/reservation-addon-cleanup-issues.repository";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { findAssignedBusinessIdsByStaffUserId } from "@/lib/repositories/staff-members.repository";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { hasPermission } from "@/lib/permissions";
import { isAdminRole, isBusinessAdminRole, isStaffRole } from "@/lib/auth/role";
import type { Profile, ReservationAddonCleanupIssueRow } from "@/types/database";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

type OperatorProfile = Pick<Profile, "id" | "role">;

async function resolveAssignedIds(profile: OperatorProfile): Promise<string[]> {
  if (isAdminRole(profile.role)) return [];
  if (isStaffRole(profile.role)) {
    return findAssignedBusinessIdsByStaffUserId(profile.id);
  }
  return findAssignedBusinessIdsByUserId(profile.id);
}

async function assertCanAccessBusiness(
  profile: OperatorProfile,
  businessId: string,
): Promise<ServiceResult<null>> {
  const assignedIds = await resolveAssignedIds(profile);
  if (!canManageBusinessForProfile(profile, businessId, assignedIds)) {
    return { ok: false, error: "この事業への操作権限がありません。", status: 403 };
  }
  return { ok: true, data: null };
}

/**
 * 未対応のアドオン後処理失敗一覧(管理画面「要対応」パネル用)。
 * cancelAddonItemsAndRestoreStock() の失敗を検知・追跡する唯一の手段。
 */
export async function listUnresolvedAddonCleanupIssues(
  profile: OperatorProfile,
  params: { businessId: string },
): Promise<ServiceResult<ReservationAddonCleanupIssueRow[]>> {
  if (!hasPermission(profile.role, "ADDON_CLEANUP_MANAGE")) {
    return { ok: false, error: "閲覧権限がありません。", status: 403 };
  }

  const auth = await assertCanAccessBusiness(profile, params.businessId);
  if (!auth.ok) return auth;

  try {
    const data = await findUnresolvedAddonCleanupIssuesByBusinessId(params.businessId);
    return { ok: true, data };
  } catch {
    return { ok: false, error: "一覧の取得に失敗しました。", status: 500 };
  }
}

/**
 * アドオン後処理失敗を「対応済み」にする。staff には許可しない
 * (reservation_addon_cleanup_issues への UPDATE 権限が RLS 上そもそも無い)。
 */
export async function resolveAddonCleanupIssue(
  profile: OperatorProfile,
  params: { businessId: string; issueId: string; note?: string | null },
): Promise<ServiceResult<null>> {
  if (!isAdminRole(profile.role) && !isBusinessAdminRole(profile.role)) {
    return { ok: false, error: "この操作を行う権限がありません。", status: 403 };
  }

  const auth = await assertCanAccessBusiness(profile, params.businessId);
  if (!auth.ok) return auth;

  try {
    const updated = await markAddonCleanupIssueResolved(
      params.issueId,
      params.businessId,
      profile.id,
      params.note ?? null,
    );
    if (!updated) {
      return {
        ok: false,
        error: "対象の記録が見つからないか、既に対応済みです。",
        status: 404,
      };
    }
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "対応済みへの更新に失敗しました。", status: 500 };
  }
}

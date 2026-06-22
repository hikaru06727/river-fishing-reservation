import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { isAdminRole } from "@/lib/auth/role";
import type { Profile } from "@/types/database";
import type { SalesReservationRow } from "@/lib/sales/sales-types";

/** business_admin は担当事業の予約のみ閲覧可能（admin は全件） */
export function filterSalesRowsForProfile(
  rows: SalesReservationRow[],
  profile: Pick<Profile, "id" | "role"> | null | undefined,
  assignedBusinessIds: readonly string[],
): SalesReservationRow[] {
  if (!profile) {
    return [];
  }
  if (isAdminRole(profile.role)) {
    return rows;
  }

  return rows.filter(
    (row) =>
      row.business_id != null &&
      canManageBusinessForProfile(profile, row.business_id, assignedBusinessIds),
  );
}

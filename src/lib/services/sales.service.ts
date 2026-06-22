import { unstable_noStore as noStore } from "next/cache";
import { getProfile, getUser } from "@/lib/auth/get-user";
import { isAdminRole, isBusinessAdminRole } from "@/lib/auth/role";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { findSalesReservationRows } from "@/lib/repositories/sales.repository";
import { aggregateSalesReport } from "@/lib/sales/sales-aggregation";
import { filterSalesRowsForProfile } from "@/lib/sales/sales-access";
import { parseSalesDateRange } from "@/lib/sales/sales-period";
import type { SalesDateRange, SalesReport } from "@/lib/sales/sales-types";

export type SalesDashboardResult = {
  report: SalesReport;
  isAdmin: boolean;
  scopedBusinessNames: string[] | null;
};

export async function getSalesDashboard(
  searchParams: Record<string, string | undefined> = {},
): Promise<SalesDashboardResult | null> {
  noStore();

  const user = await getUser();
  const profile = await getProfile();

  if (!user || !profile || (!isAdminRole(profile.role) && !isBusinessAdminRole(profile.role))) {
    return null;
  }

  const range = parseSalesDateRange(searchParams);
  const isAdmin = isAdminRole(profile.role);

  let assignedBusinessIds: string[] = [];
  if (!isAdmin) {
    try {
      assignedBusinessIds = await findAssignedBusinessIdsByUserId(user.id);
    } catch (error) {
      console.error(
        "[getSalesDashboard] assigned businesses",
        error instanceof Error ? error.message : error,
      );
      assignedBusinessIds = [];
    }
  }

  let rows;
  try {
    rows = await findSalesReservationRows(range);
  } catch (error) {
    console.error("[getSalesDashboard]", error instanceof Error ? error.message : error);
    throw new Error("売上データの取得に失敗しました。");
  }

  const scopedRows = filterSalesRowsForProfile(rows, profile, assignedBusinessIds);
  const report = aggregateSalesReport(scopedRows, range);

  let scopedBusinessNames: string[] | null = null;
  if (!isAdmin) {
    const names = new Set<string>();
    for (const row of scopedRows) {
      if (row.business_name) {
        names.add(row.business_name);
      }
    }
    scopedBusinessNames = [...names].sort((a, b) => a.localeCompare(b, "ja"));
  }

  return {
    report,
    isAdmin,
    scopedBusinessNames,
  };
}

export function buildSalesSearchParams(range: SalesDateRange): Record<string, string> {
  return {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  };
}

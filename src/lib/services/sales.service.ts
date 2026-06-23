import { unstable_noStore as noStore } from "next/cache";
import { getProfile, getUser } from "@/lib/auth/get-user";
import { isAdminRole, isBusinessAdminRole, isStaffRole } from "@/lib/auth/role";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { findAssignedBusinessIdsByStaffUserId } from "@/lib/repositories/staff-members.repository";
import { findProductSalesTotalYen, findSalesReservationRows, findTodaySalesRows } from "@/lib/repositories/sales.repository";
import { aggregateSalesReport } from "@/lib/sales/sales-aggregation";
import { filterSalesRowsForProfile } from "@/lib/sales/sales-access";
import { computeSalesInsights, type SalesInsights } from "@/lib/sales/sales-insights";
import { resolveBusinessDayCountForSales } from "@/lib/sales/sales-insights-context";
import { parseSalesDateRange } from "@/lib/sales/sales-period";
import { aggregateTodaySummary } from "@/lib/sales/today-summary";
import type { SalesDateRange, SalesReport, TodaySalesSummary } from "@/lib/sales/sales-types";

function getTodayJst(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

export type SalesDashboardResult = {
  report: SalesReport;
  insights: SalesInsights;
  isAdmin: boolean;
  scopedBusinessNames: string[] | null;
  productSalesYen: number;
  todaySummary: TodaySalesSummary;
};

export async function getSalesDashboard(
  searchParams: Record<string, string | undefined> = {},
): Promise<SalesDashboardResult | null> {
  noStore();

  const user = await getUser();
  const profile = await getProfile();

  const isAdmin = isAdminRole(profile?.role);
  const isBusinessAdmin = isBusinessAdminRole(profile?.role);
  const isStaff = isStaffRole(profile?.role);

  if (!user || !profile || (!isAdmin && !isBusinessAdmin && !isStaff)) {
    return null;
  }

  const range = parseSalesDateRange(searchParams);

  let assignedBusinessIds: string[] = [];
  if (!isAdmin) {
    try {
      if (isStaff) {
        assignedBusinessIds = await findAssignedBusinessIdsByStaffUserId(user.id);
      } else {
        assignedBusinessIds = await findAssignedBusinessIdsByUserId(user.id);
      }
    } catch (error) {
      console.error(
        "[getSalesDashboard] assigned businesses",
        error instanceof Error ? error.message : error,
      );
      assignedBusinessIds = [];
    }
  }

  const todayJst = getTodayJst();
  let rows;
  let productSalesYen = 0;
  let todaySummary: TodaySalesSummary;
  try {
    const [reservationRows, productYen, todayRaw] = await Promise.all([
      findSalesReservationRows(range),
      findProductSalesTotalYen(range).catch(() => 0),
      findTodaySalesRows(todayJst).catch(() => []),
    ]);
    rows = reservationRows;
    productSalesYen = productYen;
    todaySummary = aggregateTodaySummary(todayRaw, todayJst);
  } catch (error) {
    console.error("[getSalesDashboard]", error instanceof Error ? error.message : error);
    throw new Error("売上データの取得に失敗しました。");
  }

  const scopedRows = filterSalesRowsForProfile(rows, profile, assignedBusinessIds);
  const report = aggregateSalesReport(scopedRows, range);

  const businessDayCount = await resolveBusinessDayCountForSales(range, isAdmin, assignedBusinessIds);

  const insights = computeSalesInsights(report, businessDayCount);

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
    insights,
    isAdmin,
    scopedBusinessNames,
    productSalesYen,
    todaySummary,
  };
}

export function buildSalesSearchParams(range: SalesDateRange): Record<string, string> {
  return {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  };
}

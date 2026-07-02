import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getManagementScope } from "@/lib/auth/management-access";
import { isAdminRole } from "@/lib/auth/role";
import { findBusinessSlugById } from "@/lib/repositories/businesses.repository";
import {
  getManageableSpots,
  getRecentAdminReservations,
  getReservationStatusCounts,
  getTodayReservationCount,
} from "@/lib/reservations/get-admin-reservations";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "管理ダッシュボード",
};

interface AdminDashboardPageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const { businessId } = await searchParams;

  const [todayCount, statusCounts, recentReservations, manageableSpots, scope, shopSlug] =
    await Promise.all([
      getTodayReservationCount(),
      getReservationStatusCounts(),
      getRecentAdminReservations(10),
      getManageableSpots(),
      getManagementScope(),
      businessId ? findBusinessSlugById(businessId).catch(() => null) : Promise.resolve(null),
    ]);

  return (
    <AdminDashboard
      todayCount={todayCount}
      statusCounts={statusCounts}
      recentReservations={recentReservations}
      manageableSpots={manageableSpots}
      isAdmin={scope ? isAdminRole(scope.role) : false}
      shopSlug={shopSlug}
    />
  );
}

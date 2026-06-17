import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getManagementScope } from "@/lib/auth/management-access";
import { isAdminRole } from "@/lib/auth/role";
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

export default async function AdminDashboardPage() {
  const [todayCount, statusCounts, recentReservations, manageableSpots, scope] =
    await Promise.all([
      getTodayReservationCount(),
      getReservationStatusCounts(),
      getRecentAdminReservations(10),
      getManageableSpots(),
      getManagementScope(),
    ]);

  return (
    <AdminDashboard
      todayCount={todayCount}
      statusCounts={statusCounts}
      recentReservations={recentReservations}
      manageableSpots={manageableSpots}
      isAdmin={scope ? isAdminRole(scope.role) : false}
    />
  );
}

import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { findStaffMembersByBusinessId } from "@/lib/repositories/staff-members.repository";
import { isAdminRole } from "@/lib/auth/role";
import { StaffManagementView } from "@/components/admin/staff/StaffManagementView";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "スタッフ管理" };

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AdminStaffPage({ searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/staff");

  if (!hasPermission(session.profile.role, "STAFF_MANAGE")) {
    redirect("/admin");
  }

  const { businessId } = await searchParams;
  const isAdmin = isAdminRole(session.profile.role);

  const businesses = await findManageableBusinesses();

  if (!businessId && !isAdmin && businesses.length === 1 && businesses[0]) {
    redirect(`/admin/staff?businessId=${businesses[0].id}`);
  }

  const staffMembers = businessId
    ? await findStaffMembersByBusinessId(businessId).catch(() => [])
    : [];

  const selectedBusiness = businesses.find((b) => b.id === businessId);

  return (
    <StaffManagementView
      businesses={businesses}
      staffMembers={staffMembers}
      selectedBusinessId={businessId}
      selectedBusinessName={selectedBusiness?.name}
    />
  );
}

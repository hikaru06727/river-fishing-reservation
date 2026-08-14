import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { findStaffMembersByBusinessId } from "@/lib/repositories/staff-members.repository";
import { StaffManagementView } from "@/components/admin/staff/StaffManagementView";
import { SINGLE_BUSINESS_ID } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "スタッフ管理" };

export default async function AdminStaffPage() {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/login?next=/admin/staff");

  if (!hasPermission(session.profile.role, "STAFF_MANAGE")) {
    redirect("/admin");
  }

  const businesses = await findManageableBusinesses();
  const business = businesses[0];

  const staffMembers = business
    ? await findStaffMembersByBusinessId(SINGLE_BUSINESS_ID).catch(() => [])
    : [];

  return (
    <StaffManagementView
      business={business}
      staffMembers={staffMembers}
    />
  );
}

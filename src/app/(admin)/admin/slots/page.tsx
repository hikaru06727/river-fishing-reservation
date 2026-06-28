import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";

export default async function AdminSlotsPage() {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/slots");

  if (!hasPermission(session.profile.role, "BUSINESS_SETTINGS")) {
    redirect("/admin");
  }

  return <p className="text-muted">空き枠 CRUD（実装予定）</p>;
}

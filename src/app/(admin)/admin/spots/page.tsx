import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";

export default async function AdminSpotsPage() {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/spots");

  if (!hasPermission(session.profile.role, "BUSINESS_SETTINGS")) {
    redirect("/admin");
  }

  return <p className="text-muted">釣り場 CRUD（実装予定）</p>;
}

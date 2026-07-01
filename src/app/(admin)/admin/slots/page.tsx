import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";
import { findAllSpotIdsAndNames } from "@/lib/repositories/fishing-spots.repository";
import { SlotGenerateView } from "@/components/admin/slots/SlotGenerateView";

export const dynamic = "force-dynamic";
export const metadata = { title: "予約枠管理" };

export default async function AdminSlotsPage() {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/slots");

  if (!hasPermission(session.profile.role, "BUSINESS_SETTINGS")) {
    redirect("/admin");
  }

  const spots = await findAllSpotIdsAndNames();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-bold">予約枠管理</h1>
      <SlotGenerateView spots={spots} />
    </div>
  );
}

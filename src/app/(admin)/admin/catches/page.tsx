import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { isAdminRole } from "@/lib/auth/role";

export default async function AdminCatchesPage() {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/catches");

  if (!isAdminRole(session.profile.role)) {
    redirect("/admin");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted">釣果レポートの管理</p>
        <Link
          href="/admin/catches/new"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          新規投稿
        </Link>
      </div>
    </div>
  );
}

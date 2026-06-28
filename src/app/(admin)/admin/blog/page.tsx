import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { isAdminRole } from "@/lib/auth/role";

export default async function AdminBlogPage() {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/blog");

  if (!isAdminRole(session.profile.role)) {
    redirect("/admin");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted">ブログ記事の管理</p>
        <Link
          href="/admin/blog/new"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          新規作成
        </Link>
      </div>
    </div>
  );
}

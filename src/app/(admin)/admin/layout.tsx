import Link from "next/link";
import { redirect } from "next/navigation";
import { ManagementContextBar } from "@/components/admin/ManagementContextBar";
import { getAuthenticatedManagement, getUser } from "@/lib/auth/get-user";

const adminLinks = [
  { href: "/admin", label: "トップ" },
  { href: "/admin/reservations", label: "予約管理" },
  { href: "/admin/spots", label: "釣り場管理" },
  { href: "/admin/slots", label: "空き枠管理" },
  { href: "/admin/catches", label: "釣果管理" },
  { href: "/admin/blog", label: "ブログ管理" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthenticatedManagement();

  if (!session) {
    const user = await getUser();
    redirect(user ? "/" : "/admin/login?next=/admin");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">管理画面</h1>
        <nav className="mt-3 flex flex-wrap gap-2">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <ManagementContextBar />
      {children}
    </div>
  );
}

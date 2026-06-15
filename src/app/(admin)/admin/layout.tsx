import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";
import { isAdminUser } from "@/lib/auth/role";

const adminLinks = [
  { href: "/admin/spots", label: "釣り場管理" },
  { href: "/admin/slots", label: "空き枠管理" },
  { href: "/admin/reservations", label: "予約管理" },
  { href: "/admin/catches", label: "釣果管理" },
  { href: "/admin/blog", label: "ブログ管理" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (!isAdminUser(user)) {
    redirect("/");
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
      {children}
    </div>
  );
}

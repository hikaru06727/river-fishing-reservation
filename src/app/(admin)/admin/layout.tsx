import Link from "next/link";
import { redirect } from "next/navigation";
import { ManagementContextBar } from "@/components/admin/ManagementContextBar";
import { getAuthenticatedManagement, getUser } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";

type NavLink = { href: string; label: string };

function getNavLinks(role: string): NavLink[] {
  const links: NavLink[] = [{ href: "/admin", label: "トップ" }];

  if (hasPermission(role, "SALES_VIEW")) {
    links.push({ href: "/admin/sales", label: "売上" });
  }
  if (hasPermission(role, "POS_OPERATE")) {
    links.push({ href: "/admin/pos", label: "レジ" });
  }
  if (hasPermission(role, "POS_CLOSE")) {
    links.push({ href: "/admin/register-closing", label: "レジ締め" });
  }
  if (hasPermission(role, "RESERVATION_VIEW")) {
    links.push({ href: "/admin/reservations", label: "予約管理" });
  }
  if (hasPermission(role, "REFUND_MANAGE")) {
    links.push({ href: "/admin/refunds", label: "返金" });
  }
  if (hasPermission(role, "PRODUCT_MANAGE")) {
    links.push({ href: "/admin/plans", label: "プラン管理" });
    links.push({ href: "/admin/products", label: "商品管理" });
  }
  if (hasPermission(role, "BUSINESS_SETTINGS")) {
    links.push({ href: "/admin/business-hours", label: "営業時間設定" });
    links.push({ href: "/admin/spots", label: "釣り場管理" });
    links.push({ href: "/admin/slots", label: "空き枠管理" });
  }
  if (hasPermission(role, "STAFF_MANAGE")) {
    links.push({ href: "/admin/staff", label: "スタッフ管理" });
  }

  // admin は全メニュー表示
  if (role === "admin") {
    return [
      { href: "/admin", label: "トップ" },
      { href: "/admin/sales", label: "売上" },
      { href: "/admin/pos", label: "レジ" },
      { href: "/admin/register-closing", label: "レジ締め" },
      { href: "/admin/reservations", label: "予約管理" },
      { href: "/admin/refunds", label: "返金" },
      { href: "/admin/plans", label: "プラン管理" },
      { href: "/admin/products", label: "商品管理" },
      { href: "/admin/business-hours", label: "営業時間設定" },
      { href: "/admin/spots", label: "釣り場管理" },
      { href: "/admin/slots", label: "空き枠管理" },
      { href: "/admin/catches", label: "釣果管理" },
      { href: "/admin/blog", label: "ブログ管理" },
      { href: "/admin/staff", label: "スタッフ管理" },
    ];
  }

  return links;
}

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

  const role = session.profile.role;
  const navLinks = getNavLinks(role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">管理画面</h1>
        <nav className="mt-3 flex flex-wrap gap-2">
          {navLinks.map((link) => (
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/format";

const navItems = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/spots", label: "釣り場", icon: "🎣" },
  { href: "/catches", label: "釣果", icon: "🐟" },
  { href: "/blog", label: "ブログ", icon: "📝" },
  { href: "/my/reservations", label: "予約", icon: "📅" },
];

export function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex items-stretch justify-around">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-2 text-xs transition-colors",
                  isActive ? "text-primary" : "text-muted",
                )}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

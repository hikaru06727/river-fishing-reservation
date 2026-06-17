import Link from "next/link";
import { getAuthNavState } from "@/lib/auth/get-user";
import { LogoutButton } from "@/components/layout/LogoutButton";

const mainNavLinks = [
  { href: "/spots", label: "釣り場" },
  { href: "/catches", label: "釣果" },
  { href: "/blog", label: "ブログ" },
];

export async function Header() {
  const auth = await getAuthNavState();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" className="shrink-0 text-lg font-bold text-primary">
          川釣り予約
        </Link>

        {/* PC: メインナビ + 認証 */}
        <nav className="hidden min-w-0 flex-1 items-center justify-end gap-4 text-sm md:flex">
          {mainNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-foreground hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/my/reservations"
            className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground hover:opacity-90"
          >
            マイ予約
          </Link>

          {auth.isAdmin && (
            <Link
              href="/admin/reservations"
              className="rounded-full border border-primary px-4 py-1.5 text-primary hover:bg-primary/5"
            >
              管理画面
            </Link>
          )}

          {auth.isLoggedIn ? (
            <div className="flex max-w-[220px] items-center gap-3 border-l border-border pl-4">
              <span
                className="truncate text-muted"
                title={auth.email ?? undefined}
              >
                {auth.email ?? "ログイン中"}
              </span>
              <LogoutButton />
            </div>
          ) : (
            <Link
              href="/login"
              className="border-l border-border pl-4 text-foreground hover:text-primary"
            >
              ログイン
            </Link>
          )}
        </nav>

        {/* スマホ: 認証のみ（BottomNav がメインナビ） */}
        <div className="flex min-w-0 items-center gap-2 text-sm md:hidden">
          {auth.isAdmin && (
            <Link
              href="/admin/reservations"
              className="shrink-0 rounded-full border border-primary px-2.5 py-1 text-xs text-primary"
            >
              管理
            </Link>
          )}

          {auth.isLoggedIn ? (
            <>
              <span
                className="max-w-[120px] truncate text-xs text-muted"
                title={auth.email ?? undefined}
              >
                {auth.email ?? "ログイン中"}
              </span>
              <LogoutButton className="shrink-0 text-xs text-muted underline-offset-2 hover:text-foreground hover:underline" />
            </>
          ) : (
            <Link href="/login" className="shrink-0 text-foreground hover:text-primary">
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

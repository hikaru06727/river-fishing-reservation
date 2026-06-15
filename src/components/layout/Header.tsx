import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-primary">
          川釣り予約
        </Link>
        <nav className="hidden items-center gap-4 text-sm md:flex">
          <Link href="/spots" className="text-foreground hover:text-primary">
            釣り場
          </Link>
          <Link href="/catches" className="text-foreground hover:text-primary">
            釣果
          </Link>
          <Link href="/blog" className="text-foreground hover:text-primary">
            ブログ
          </Link>
          <Link
            href="/my/reservations"
            className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground hover:opacity-90"
          >
            マイ予約
          </Link>
        </nav>
      </div>
    </header>
  );
}

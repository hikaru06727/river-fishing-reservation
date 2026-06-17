import Link from "next/link";
import { cn } from "@/lib/utils/format";

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}

function buildPageUrl(
  basePath: string,
  page: number,
  searchParams: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value) {
      params.set(key, value);
    }
  }

  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1"
      aria-label="ページネーション"
    >
      {page > 1 && (
        <Link
          href={buildPageUrl(basePath, page - 1, searchParams)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          前へ
        </Link>
      )}

      {pages.map((p, index) => {
        const prev = pages[index - 1];
        const showEllipsis = prev !== undefined && p - prev > 1;

        return (
          <span key={p} className="flex items-center gap-1">
            {showEllipsis && <span className="px-1 text-muted">…</span>}
            <Link
              href={buildPageUrl(basePath, p, searchParams)}
              className={cn(
                "min-w-9 rounded-lg border px-3 py-1.5 text-center text-sm",
                p === page
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-slate-50",
              )}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </Link>
          </span>
        );
      })}

      {page < totalPages && (
        <Link
          href={buildPageUrl(basePath, page + 1, searchParams)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          次へ
        </Link>
      )}
    </nav>
  );
}

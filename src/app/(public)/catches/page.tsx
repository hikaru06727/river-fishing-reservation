import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "釣果情報" };

export const dynamic = "force-dynamic";

export default async function CatchesPage() {
  const supabase = await createClient();
  const { data: catches } = await supabase
    .from("catch_reports")
    .select("id, caught_date, fish_species, length_cm, title, description")
    .eq("status", "published")
    .order("caught_date", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold">釣果情報</h1>
      <p className="mt-2 text-sm text-muted">最新の釣果をお届けします</p>

      {(catches ?? []).length === 0 ? (
        <p className="mt-8 text-sm text-muted">釣果レポートはまだありません。</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {(catches ?? []).map((item) => {
            const sizeLabel =
              item.length_cm != null ? `${item.length_cm}cm` : null;
            const excerpt =
              item.description?.split("\n\n")[0]?.slice(0, 120) ?? item.title;

            return (
              <li key={item.id}>
                <Link
                  href={`/catches/${item.id}`}
                  className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span>
                      {item.caught_date ? formatDate(item.caught_date) : "—"}
                    </span>
                    <span>
                      {item.fish_species ?? item.title}
                      {sizeLabel ? ` ${sizeLabel}` : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{excerpt}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

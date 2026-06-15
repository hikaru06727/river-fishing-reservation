import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

interface CatchDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CatchDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("catch_reports")
    .select("title, fish_species")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  return { title: item?.fish_species ?? item?.title ?? "釣果詳細" };
}

export default async function CatchDetailPage({ params }: CatchDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("catch_reports")
    .select("caught_date, fish_species, length_cm, title, description, image_url")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!item) {
    notFound();
  }

  const sizeLabel = item.length_cm != null ? `${item.length_cm}cm` : null;

  return (
    <article>
      <Link href="/catches" className="text-sm text-primary hover:underline">
        ← 釣果一覧
      </Link>
      <h1 className="mt-4 text-2xl font-bold">
        {item.fish_species ?? item.title}
        {sizeLabel ? ` ${sizeLabel}` : ""}
      </h1>
      {item.caught_date && (
        <p className="mt-1 text-sm text-muted">{formatDate(item.caught_date)}</p>
      )}
      {item.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image_url}
          alt={item.title}
          className="mt-6 aspect-video w-full rounded-2xl object-cover"
        />
      ) : (
        <div className="mt-6 aspect-video rounded-2xl bg-slate-100" aria-hidden="true" />
      )}
      {item.description && (
        <p className="mt-6 whitespace-pre-wrap leading-relaxed text-foreground">
          {item.description}
        </p>
      )}
    </article>
  );
}

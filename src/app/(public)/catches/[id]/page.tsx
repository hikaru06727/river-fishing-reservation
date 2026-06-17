import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findPublishedCatchReportDetailById,
  findPublishedCatchReportMetadataById,
} from "@/lib/repositories/catch-reports.repository";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

interface CatchDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CatchDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const item = await findPublishedCatchReportMetadataById(id);
    return { title: item?.fish_species ?? item?.title ?? "釣果詳細" };
  } catch (error) {
    console.error("[CatchDetailPage metadata]", error instanceof Error ? error.message : error);
    return { title: "釣果詳細" };
  }
}

export default async function CatchDetailPage({ params }: CatchDetailPageProps) {
  const { id } = await params;
  let item: Awaited<ReturnType<typeof findPublishedCatchReportDetailById>> = null;
  try {
    item = await findPublishedCatchReportDetailById(id);
  } catch (error) {
    console.error("[CatchDetailPage]", error instanceof Error ? error.message : error);
  }

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

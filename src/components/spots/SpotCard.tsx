import Image from "next/image";
import Link from "next/link";
import type { SpotListItem } from "@/lib/spots/get-spots";

interface SpotCardProps {
  spot: SpotListItem;
}

export function SpotCard({ spot }: SpotCardProps) {
  return (
    <Link
      href={`/spots/${spot.slug}`}
      className="group block overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-sky-100">
        {spot.image_url ? (
          <Image
            src={spot.image_url}
            alt={spot.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-sky-100 to-sky-200">
            <span className="text-4xl" aria-hidden="true">
              🎣
            </span>
          </div>
        )}
        {spot.prefecture && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-sky-800 backdrop-blur-sm">
            {spot.prefecture}
          </span>
        )}
      </div>

      <div className="p-4">
        <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
          {spot.name}
        </h2>
        {spot.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
            {spot.description}
          </p>
        )}
        <p className="mt-3 text-sm font-medium text-primary">詳細を見る →</p>
      </div>
    </Link>
  );
}

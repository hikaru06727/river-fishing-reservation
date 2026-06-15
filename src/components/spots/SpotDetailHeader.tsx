import Image from "next/image";
import { Card } from "@/components/ui/Card";
import type { SpotDetail } from "@/lib/spots/get-spot-by-slug";

interface SpotDetailHeaderProps {
  spot: SpotDetail;
}

export function SpotDetailHeader({ spot }: SpotDetailHeaderProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="relative aspect-[16/9] w-full bg-sky-100 sm:aspect-[21/9]">
        {spot.image_url ? (
          <Image
            src={spot.image_url}
            alt={spot.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 896px"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-sky-100 to-sky-200">
            <span className="text-6xl" aria-hidden="true">
              🎣
            </span>
          </div>
        )}
        {spot.prefecture && (
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-sky-800 backdrop-blur-sm">
            {spot.prefecture}
          </span>
        )}
      </div>

      <div className="p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{spot.name}</h1>

        {spot.address && (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
            <span aria-hidden="true">📍</span>
            {spot.address}
          </p>
        )}

        {spot.description && (
          <p className="mt-4 text-sm leading-relaxed text-foreground sm:text-base">
            {spot.description}
          </p>
        )}

        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm">
          <span className="text-muted">定員</span>
          <span className="font-semibold text-sky-800">{spot.capacity}名</span>
        </div>
      </div>
    </Card>
  );
}

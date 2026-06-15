import { SpotsSkeleton } from "@/components/spots/SpotsSkeleton";

export default function SpotsLoading() {
  return (
    <div className="space-y-6">
      <header>
        <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-slate-100" />
      </header>
      <SpotsSkeleton />
    </div>
  );
}

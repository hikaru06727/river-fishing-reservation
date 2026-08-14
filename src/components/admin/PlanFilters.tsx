import Link from "next/link";
import type { ManageableSpotRow } from "@/lib/repositories/businesses.repository";

interface PlanFiltersProps {
  spotId?: string;
  spots: ManageableSpotRow[];
}

export function PlanFilters({ spotId, spots }: PlanFiltersProps) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <label htmlFor="spotId" className="block text-xs font-medium text-muted">
          釣り場
        </label>
        <select
          id="spotId"
          name="spotId"
          defaultValue={spotId ?? ""}
          className="mt-1 min-h-10 rounded-lg border border-border px-3 text-sm"
        >
          <option value="">すべて</option>
          {spots.map((spot) => (
            <option key={spot.id} value={spot.id}>
              {spot.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        絞り込む
      </button>

      {spotId && (
        <Link href="/admin/plans" className="text-sm text-primary hover:underline">
          クリア
        </Link>
      )}
    </form>
  );
}

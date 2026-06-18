import Link from "next/link";
import type { ManageableBusinessRow, ManageableSpotRow } from "@/lib/repositories/businesses.repository";

interface PlanFiltersProps {
  businessId?: string;
  spotId?: string;
  businesses: ManageableBusinessRow[];
  spots: ManageableSpotRow[];
  showBusinessFilter: boolean;
}

export function PlanFilters({
  businessId,
  spotId,
  businesses,
  spots,
  showBusinessFilter,
}: PlanFiltersProps) {
  const filteredSpots =
    businessId != null
      ? spots.filter((spot) => spot.business_id === businessId)
      : spots;

  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {showBusinessFilter && (
        <div>
          <label htmlFor="businessId" className="block text-xs font-medium text-muted">
            事業
          </label>
          <select
            id="businessId"
            name="businessId"
            defaultValue={businessId ?? ""}
            className="mt-1 min-h-10 rounded-lg border border-border px-3 text-sm"
          >
            <option value="">すべて</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
          {filteredSpots.map((spot) => (
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

      {(businessId || spotId) && (
        <Link href="/admin/plans" className="text-sm text-primary hover:underline">
          クリア
        </Link>
      )}
    </form>
  );
}

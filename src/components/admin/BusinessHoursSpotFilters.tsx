import Link from "next/link";
import type { ManageableBusinessRow, ManageableSpotRow } from "@/lib/repositories/businesses.repository";

interface BusinessHoursSpotFiltersProps {
  businessId?: string;
  spotId?: string;
  businesses: ManageableBusinessRow[];
  spots: ManageableSpotRow[];
  showBusinessFilter: boolean;
}

export function BusinessHoursSpotFilters({
  businessId,
  spotId,
  businesses,
  spots,
  showBusinessFilter,
}: BusinessHoursSpotFiltersProps) {
  const filteredSpots =
    businessId != null ? spots.filter((spot) => spot.business_id === businessId) : spots;

  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
    >
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
          釣り場 <span className="text-red-600">*</span>
        </label>
        <select
          id="spotId"
          name="spotId"
          required
          defaultValue={spotId ?? ""}
          className="mt-1 min-h-10 rounded-lg border border-border px-3 text-sm"
        >
          <option value="" disabled>
            選択してください
          </option>
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
        表示
      </button>

      {spotId && (
        <Link href="/admin/business-hours" className="text-sm text-primary hover:underline">
          クリア
        </Link>
      )}
    </form>
  );
}

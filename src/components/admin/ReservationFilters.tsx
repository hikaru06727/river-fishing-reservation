import Link from "next/link";
import type { ReservationStatus } from "@/types/domain";
import type { ManageableSpot } from "@/lib/reservations/get-admin-reservations";

const STATUS_OPTIONS: Array<{ value: ReservationStatus | "all"; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "仮予約" },
  { value: "confirmed", label: "確定" },
  { value: "cancelled", label: "キャンセル済" },
  { value: "expired", label: "期限切れ" },
];

interface ReservationFiltersProps {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: ReservationStatus | "all";
  spotId?: string;
  spots: ManageableSpot[];
}

export function ReservationFilters({
  date,
  dateFrom,
  dateTo,
  status = "all",
  spotId,
  spots,
}: ReservationFiltersProps) {
  return (
    <form
      method="get"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:flex-wrap lg:items-end"
    >
      <div className="min-w-[140px] flex-1">
        <label htmlFor="date" className="block text-sm font-medium">
          利用日（単日）
        </label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={date ?? ""}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="min-w-[140px] flex-1">
        <label htmlFor="dateFrom" className="block text-sm font-medium">
          期間（開始）
        </label>
        <input
          id="dateFrom"
          name="dateFrom"
          type="date"
          defaultValue={dateFrom ?? ""}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="min-w-[140px] flex-1">
        <label htmlFor="dateTo" className="block text-sm font-medium">
          期間（終了）
        </label>
        <input
          id="dateTo"
          name="dateTo"
          type="date"
          defaultValue={dateTo ?? ""}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="min-w-[140px] flex-1">
        <label htmlFor="status" className="block text-sm font-medium">
          ステータス
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[160px] flex-1">
        <label htmlFor="spotId" className="block text-sm font-medium">
          釣り場
        </label>
        <select
          id="spotId"
          name="spotId"
          defaultValue={spotId ?? ""}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="">すべて</option>
          {spots.map((spot) => (
            <option key={spot.id} value={spot.id}>
              {spot.name}
              {!spot.is_active ? "（非公開）" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          絞り込み
        </button>
        <Link
          href="/admin/reservations"
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm hover:bg-slate-50"
        >
          クリア
        </Link>
      </div>
    </form>
  );
}

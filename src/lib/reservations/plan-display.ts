export type ReservationPlanJoin = {
  name?: string | null;
  slug?: string | null;
  duration_minutes?: number | null;
  price_yen?: number | null;
} | null;

export type ReservationPlanSnapshotSource = {
  reserved_plan_name?: string | null;
  reserved_unit_price_yen?: number | null;
  reserved_duration_minutes?: number | null;
  plans?: ReservationPlanJoin;
};

export type ReservationPlanDisplayOptions = {
  /** UI 既定 "—" / メール等は "プラン" */
  nameFallback?: string;
};

export type ReservationPlanDisplay = {
  name: string;
  unitPriceYen: number | null;
  durationMinutes: number | null;
};

/** 表示・メール・Stripe で snapshot 優先のプラン情報を返す */
export function getReservationPlanDisplay(
  row: ReservationPlanSnapshotSource,
  options: ReservationPlanDisplayOptions = {},
): ReservationPlanDisplay {
  const nameFallback = options.nameFallback ?? "—";

  return {
    name: row.reserved_plan_name ?? row.plans?.name ?? nameFallback,
    unitPriceYen: row.reserved_unit_price_yen ?? row.plans?.price_yen ?? null,
    durationMinutes:
      row.reserved_duration_minutes ?? row.plans?.duration_minutes ?? null,
  };
}

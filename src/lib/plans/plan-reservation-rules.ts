import type { Plan } from "@/types/database";

export type PlanBookabilityFields = Pick<
  Plan,
  "is_active" | "is_visible" | "is_accepting_reservations" | "location_id"
>;

export function meetsBookablePlanConditions(plan: PlanBookabilityFields): boolean {
  return plan.is_active && plan.is_visible && plan.is_accepting_reservations;
}

/**
 * spot 別プランが存在する場合は legacy（location_id IS NULL）を除外する。
 */
export function isPlanAllowedForSpot(
  plan: PlanBookabilityFields,
  spotId: string,
  hasSpotSpecificBookablePlans: boolean,
): boolean {
  if (!meetsBookablePlanConditions(plan)) {
    return false;
  }
  if (plan.location_id === null) {
    return !hasSpotSpecificBookablePlans;
  }
  return plan.location_id === spotId;
}

/** spot 別プランがあればそれのみ、なければ legacy 共通プラン */
export function resolveBookablePlansForSpot(
  spotSpecificPlans: readonly Plan[],
  legacyPlans: readonly Plan[],
): Plan[] {
  if (spotSpecificPlans.length > 0) {
    return [...spotSpecificPlans];
  }
  return [...legacyPlans];
}

export type PlanReservationValidationResult =
  | { ok: true; plan: Plan }
  | { ok: false; error: string };

export function validatePlanForReservation(
  plan: Plan | null,
  spotId: string,
  hasSpotSpecificBookablePlans: boolean,
): PlanReservationValidationResult {
  if (!plan) {
    return { ok: false, error: "選択されたプランが見つかりません" };
  }
  if (!plan.is_active) {
    return { ok: false, error: "選択されたプランは現在利用できません" };
  }
  if (!plan.is_visible) {
    return { ok: false, error: "選択されたプランは現在公開されていません" };
  }
  if (!plan.is_accepting_reservations) {
    return { ok: false, error: "選択されたプランは現在予約を受け付けていません" };
  }
  if (!isPlanAllowedForSpot(plan, spotId, hasSpotSpecificBookablePlans)) {
    return { ok: false, error: "選択されたプランはこの釣り場では利用できません" };
  }
  return { ok: true, plan };
}

/** 参加人数の上限（plan.max_guests とアプリ全体上限の小さい方） */
export function getMaxGuestCountForPlan(plan: Pick<Plan, "max_guests">): number {
  const GLOBAL_MAX_GUEST_COUNT = 20;
  return Math.min(plan.max_guests, GLOBAL_MAX_GUEST_COUNT);
}

export function validateGuestCountForPlan(
  guestCount: number,
  plan: Pick<Plan, "max_guests">,
): PlanReservationValidationResult | { ok: true } {
  const maxGuests = getMaxGuestCountForPlan(plan);
  if (guestCount > maxGuests) {
    return {
      ok: false,
      error: `参加人数は${maxGuests}名以下です`,
    };
  }
  return { ok: true };
}

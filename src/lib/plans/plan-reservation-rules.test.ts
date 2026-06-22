import { describe, expect, it } from "vitest";
import {
  getMaxGuestCountForPlan,
  isPlanAllowedForSpot,
  meetsBookablePlanConditions,
  resolveBookablePlansForSpot,
  validateGuestCountForPlan,
  validatePlanForReservation,
} from "./plan-reservation-rules";
import type { Plan } from "@/types/database";

const spotA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const spotB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makePlan(overrides: Partial<Plan> & Pick<Plan, "id" | "name" | "slug">): Plan {
  return {
    duration_minutes: 60,
    price_yen: 3000,
    is_active: true,
    location_id: spotA,
    description: null,
    max_guests: 4,
    is_visible: true,
    is_accepting_reservations: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("meetsBookablePlanConditions", () => {
  it("is_accepting_reservations=false のプランは予約不可", () => {
    const plan = makePlan({
      id: "p1",
      name: "停止中",
      slug: "stopped",
      is_accepting_reservations: false,
    });
    expect(meetsBookablePlanConditions(plan)).toBe(false);
  });

  it("is_visible=false のプランは予約不可", () => {
    const plan = makePlan({
      id: "p2",
      name: "非表示",
      slug: "hidden",
      is_visible: false,
    });
    expect(meetsBookablePlanConditions(plan)).toBe(false);
  });

  it("is_active=false のプランは予約不可", () => {
    const plan = makePlan({
      id: "p3",
      name: "無効",
      slug: "inactive",
      is_active: false,
    });
    expect(meetsBookablePlanConditions(plan)).toBe(false);
  });
});

describe("resolveBookablePlansForSpot", () => {
  const spotPlan = makePlan({ id: "spot-plan", name: "Spot", slug: "spot-plan" });
  const legacy = makePlan({
    id: "legacy-1h",
    name: "1h",
    slug: "1h",
    location_id: null,
  });

  it("spot 別プランがある場合は spot 別プランを優先する", () => {
    expect(resolveBookablePlansForSpot([spotPlan], [legacy])).toEqual([spotPlan]);
  });

  it("spot 別プランがない場合は legacy 共通プランを返す", () => {
    expect(resolveBookablePlansForSpot([], [legacy])).toEqual([legacy]);
  });
});

describe("isPlanAllowedForSpot", () => {
  const legacy = makePlan({
    id: "legacy-1h",
    name: "1h",
    slug: "1h",
    location_id: null,
  });
  const spotPlan = makePlan({ id: "spot-plan", name: "Spot", slug: "spot-plan" });
  const otherSpotPlan = makePlan({
    id: "other",
    name: "Other",
    slug: "other",
    location_id: spotB,
  });

  it("legacy 共通プランは移行期間中は許可される", () => {
    expect(isPlanAllowedForSpot(legacy, spotA, false)).toBe(true);
  });

  it("spot 別プランがある場合 legacy は許可されない", () => {
    expect(isPlanAllowedForSpot(legacy, spotA, true)).toBe(false);
  });

  it("担当外 spot の plan は許可されない", () => {
    expect(isPlanAllowedForSpot(otherSpotPlan, spotA, true)).toBe(false);
  });

  it("対象 spot の plan は許可される", () => {
    expect(isPlanAllowedForSpot(spotPlan, spotA, true)).toBe(true);
  });
});

describe("validatePlanForReservation", () => {
  const legacy = makePlan({
    id: "legacy-1h",
    name: "1h",
    slug: "1h",
    location_id: null,
  });

  it("slug だけで担当外 spot の plan は拒否される", () => {
    const otherSpotPlan = makePlan({
      id: "other",
      name: "Other",
      slug: "other",
      location_id: spotB,
    });
    const result = validatePlanForReservation(otherSpotPlan, spotA, true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("この釣り場では利用できません");
    }
  });

  it("legacy 共通プランは移行期間中は許可される", () => {
    const result = validatePlanForReservation(legacy, spotA, false);
    expect(result.ok).toBe(true);
  });
});

describe("validateGuestCountForPlan", () => {
  it("guest_count > plan.max_guests の場合は拒否される", () => {
    const plan = makePlan({ id: "p1", name: "Plan", slug: "plan", max_guests: 4 });
    const result = validateGuestCountForPlan(5, plan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("4名以下");
    }
  });

  it("getMaxGuestCountForPlan は plan.max_guests と全体上限の小さい方", () => {
    expect(getMaxGuestCountForPlan(makePlan({ id: "p", name: "P", slug: "p", max_guests: 4 }))).toBe(
      4,
    );
    expect(
      getMaxGuestCountForPlan(makePlan({ id: "p", name: "P", slug: "p", max_guests: 30 })),
    ).toBe(20);
  });
});

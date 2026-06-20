import { describe, expect, it } from "vitest";
import {
  filterAdminPlansForProfile,
  filterSelectableSpotsForProfile,
} from "./admin-plan-scope";
import type { AdminPlanRow } from "@/lib/repositories/plans.repository";
import type { ManageableSpotRow } from "@/lib/repositories/businesses.repository";
import type { Profile } from "@/types/database";

function profile(role: Profile["role"]): Pick<Profile, "role" | "id"> {
  return { id: "user-1", role };
}

const bizA = "biz-a";
const bizB = "biz-b";
const spotA = "spot-a";
const spotB = "spot-b";
const assigned = [bizA];

const spots: ManageableSpotRow[] = [
  { id: spotA, name: "担当釣り場", business_id: bizA, is_active: true },
  { id: spotB, name: "担当外釣り場", business_id: bizB, is_active: true },
];

function makePlan(overrides: Partial<AdminPlanRow> & Pick<AdminPlanRow, "id" | "name">): AdminPlanRow {
  return {
    slug: "plan-a",
    duration_minutes: 60,
    price_yen: 3000,
    is_active: true,
    fishing_spot_id: spotA,
    description: null,
    max_guests: 4,
    is_visible: true,
    is_accepting_reservations: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    fishing_spots: { name: "担当釣り場", business_id: bizA },
    ...overrides,
  };
}

describe("filterSelectableSpotsForProfile", () => {
  it("admin は全 spot を選べる", () => {
    expect(filterSelectableSpotsForProfile(spots, profile("admin"), [])).toEqual(spots);
  });

  it("business_admin の selectable spots に担当外 spot が含まれない", () => {
    const result = filterSelectableSpotsForProfile(spots, profile("business_admin"), assigned);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(spotA);
  });
});

describe("filterAdminPlansForProfile", () => {
  const plans = [
    makePlan({ id: "plan-1", name: "担当プラン", fishing_spot_id: spotA }),
    makePlan({
      id: "plan-2",
      name: "担当外プラン",
      fishing_spot_id: spotB,
      fishing_spots: { name: "担当外釣り場", business_id: bizB },
    }),
  ];

  it("admin は全プランを見られる", () => {
    expect(filterAdminPlansForProfile(plans, profile("admin"), [])).toHaveLength(2);
  });

  it("business_admin の一覧に担当外プランが出ない", () => {
    const result = filterAdminPlansForProfile(plans, profile("business_admin"), assigned);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("plan-1");
  });

  it("business_admin は共通プラン（fishing_spot_id null）を除外する", () => {
    const legacy = makePlan({
      id: "legacy-1h",
      name: "1時間プラン",
      fishing_spot_id: null,
      fishing_spots: null,
    });
    const result = filterAdminPlansForProfile(
      [legacy, plans[0]!],
      profile("business_admin"),
      assigned,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("plan-1");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: vi.fn(),
  findSpotBusinessIdBySpotId: vi.fn(),
}));

vi.mock("@/lib/repositories/plans.repository", () => ({
  insertPlan: vi.fn(),
}));

import {
  findAssignedBusinessIdsByUserId,
  findSpotBusinessIdBySpotId,
} from "@/lib/repositories/businesses.repository";
import { insertPlan } from "@/lib/repositories/plans.repository";
import { createAdminPlan } from "./plans.service";

const bizA = "11111111-1111-4111-8111-111111111111";
const bizB = "22222222-2222-4222-8222-222222222222";
const spotA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const spotB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const businessAdminProfile = { id: "ba-user", role: "business_admin" as const };

const validInput = {
  name: "半日プラン",
  description: null,
  priceYen: 5000,
  durationMinutes: 180,
  maxGuests: 4,
  fishingSpotId: spotB,
  isVisible: true,
  isAcceptingReservations: true,
};

describe("createAdminPlan", () => {
  beforeEach(() => {
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizA]);
    vi.mocked(insertPlan).mockResolvedValue({
      id: "plan-new",
      name: validInput.name,
      slug: "plan-new",
      duration_minutes: validInput.durationMinutes,
      price_yen: validInput.priceYen,
      is_active: true,
      location_id: spotB,
      description: null,
      max_guests: validInput.maxGuests,
      is_visible: true,
      is_accepting_reservations: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
  });

  it("business_admin が担当外 spot id を送ると拒否する", async () => {
    vi.mocked(findSpotBusinessIdBySpotId).mockResolvedValue(bizB);

    const result = await createAdminPlan(businessAdminProfile, validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toContain("権限");
    }
    expect(insertPlan).not.toHaveBeenCalled();
  });

  it("business_admin が担当 spot id を送ると作成できる", async () => {
    vi.mocked(findSpotBusinessIdBySpotId).mockResolvedValue(bizA);

    const result = await createAdminPlan(businessAdminProfile, {
      ...validInput,
      fishingSpotId: spotA,
    });

    expect(result.ok).toBe(true);
    expect(insertPlan).toHaveBeenCalledOnce();
  });
});

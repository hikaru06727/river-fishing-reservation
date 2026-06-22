import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: vi.fn(),
  findSpotBusinessIdBySpotId: vi.fn(),
}));

vi.mock("@/lib/repositories/business-breaks.repository", () => ({
  replaceWeeklyBreaksForSpot: vi.fn(),
}));

import { findAssignedBusinessIdsByUserId, findSpotBusinessIdBySpotId } from "@/lib/repositories/businesses.repository";
import { replaceWeeklyBreaksForSpot } from "@/lib/repositories/business-breaks.repository";
import { saveWeeklyBreaksForSpot } from "./business-breaks.service";

const spotA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bizA = "11111111-1111-4111-8111-111111111111";
const bizB = "22222222-2222-4222-8222-222222222222";

const adminProfile = { id: "admin-user", role: "admin" as const };
const businessAdminProfile = { id: "ba-user", role: "business_admin" as const };

const validWeeklyBreaksInput = {
  fishingSpotId: spotA,
  breaks: [
    {
      dayOfWeek: 1,
      startTime: "12:00",
      endTime: "13:00",
      label: "昼休み",
    },
  ],
};

describe("saveWeeklyBreaksForSpot permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("business_admin が担当外 spot を保存しようとすると拒否する", async () => {
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizA]);
    vi.mocked(findSpotBusinessIdBySpotId).mockResolvedValue(bizB);

    const result = await saveWeeklyBreaksForSpot(businessAdminProfile, validWeeklyBreaksInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
    expect(replaceWeeklyBreaksForSpot).not.toHaveBeenCalled();
  });

  it("business_admin が担当 spot を保存できる", async () => {
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizA]);
    vi.mocked(findSpotBusinessIdBySpotId).mockResolvedValue(bizA);
    vi.mocked(replaceWeeklyBreaksForSpot).mockResolvedValue([]);

    const result = await saveWeeklyBreaksForSpot(businessAdminProfile, validWeeklyBreaksInput);

    expect(result.ok).toBe(true);
    expect(replaceWeeklyBreaksForSpot).toHaveBeenCalled();
  });

  it("admin は担当外 spot も保存できる", async () => {
    vi.mocked(findSpotBusinessIdBySpotId).mockResolvedValue(bizB);
    vi.mocked(replaceWeeklyBreaksForSpot).mockResolvedValue([]);

    const result = await saveWeeklyBreaksForSpot(adminProfile, validWeeklyBreaksInput);

    expect(result.ok).toBe(true);
    expect(findAssignedBusinessIdsByUserId).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: vi.fn(),
  findSpotBusinessIdBySpotId: vi.fn(),
}));

vi.mock("@/lib/repositories/business-hours.repository", () => ({
  findWeeklyHoursBySpotId: vi.fn(),
  findDateExceptionsBySpotId: vi.fn(),
  upsertWeeklyHoursForSpot: vi.fn(),
  insertDateException: vi.fn(),
  updateDateExceptionById: vi.fn(),
  deleteDateExceptionById: vi.fn(),
  findDateExceptionSpotIdById: vi.fn(),
}));

import { findAssignedBusinessIdsByUserId, findSpotBusinessIdBySpotId } from "@/lib/repositories/businesses.repository";
import { upsertWeeklyHoursForSpot } from "@/lib/repositories/business-hours.repository";
import { canManageBusinessHoursForProfile } from "@/lib/business-hours/business-hours-access";
import { saveWeeklyHoursForSpot } from "./business-hours.service";

const spotA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bizA = "11111111-1111-4111-8111-111111111111";
const bizB = "22222222-2222-4222-8222-222222222222";

const adminProfile = { id: "admin-user", role: "admin" as const };
const businessAdminProfile = { id: "ba-user", role: "business_admin" as const };

const validWeeklyInput = {
  fishingSpotId: spotA,
  days: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: dayOfWeek >= 1 && dayOfWeek <= 5,
    is24Hours: false,
    openTime: dayOfWeek >= 1 && dayOfWeek <= 5 ? "09:00" : null,
    closeTime: dayOfWeek >= 1 && dayOfWeek <= 5 ? "17:00" : null,
  })),
};

describe("canManageBusinessHoursForProfile", () => {
  it("admin は全 spot 編集可能", () => {
    expect(canManageBusinessHoursForProfile(adminProfile, bizA, [])).toBe(true);
    expect(canManageBusinessHoursForProfile(adminProfile, null, [])).toBe(true);
  });

  it("business_admin は担当 spot のみ編集可能", () => {
    expect(canManageBusinessHoursForProfile(businessAdminProfile, bizA, [bizA])).toBe(
      true,
    );
    expect(canManageBusinessHoursForProfile(businessAdminProfile, bizB, [bizA])).toBe(
      false,
    );
    expect(canManageBusinessHoursForProfile(businessAdminProfile, null, [bizA])).toBe(
      false,
    );
  });
});

describe("saveWeeklyHoursForSpot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("business_admin が担当外 spot を保存しようとすると拒否する", async () => {
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizA]);
    vi.mocked(findSpotBusinessIdBySpotId).mockResolvedValue(bizB);

    const result = await saveWeeklyHoursForSpot(businessAdminProfile, validWeeklyInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
    expect(upsertWeeklyHoursForSpot).not.toHaveBeenCalled();
  });

  it("business_admin が担当 spot を保存できる", async () => {
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizA]);
    vi.mocked(findSpotBusinessIdBySpotId).mockResolvedValue(bizA);
    vi.mocked(upsertWeeklyHoursForSpot).mockResolvedValue([]);

    const result = await saveWeeklyHoursForSpot(businessAdminProfile, validWeeklyInput);

    expect(result.ok).toBe(true);
    expect(upsertWeeklyHoursForSpot).toHaveBeenCalledWith(spotA, expect.any(Array));
  });

  it("admin は担当外 spot も保存できる", async () => {
    vi.mocked(findSpotBusinessIdBySpotId).mockResolvedValue(bizB);
    vi.mocked(upsertWeeklyHoursForSpot).mockResolvedValue([]);

    const result = await saveWeeklyHoursForSpot(adminProfile, validWeeklyInput);

    expect(result.ok).toBe(true);
    expect(findAssignedBusinessIdsByUserId).not.toHaveBeenCalled();
  });
});

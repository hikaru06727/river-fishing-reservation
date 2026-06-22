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
import {
  insertDateException,
  findDateExceptionSpotIdById,
  updateDateExceptionById,
  upsertWeeklyHoursForSpot,
} from "@/lib/repositories/business-hours.repository";
import { canManageBusinessHoursForProfile } from "@/lib/business-hours/business-hours-access";
import {
  createDateExceptionForSpot,
  saveWeeklyHoursForSpot,
  updateDateExceptionForSpot,
} from "./business-hours.service";

const spotA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bizA = "11111111-1111-4111-8111-111111111111";
const bizB = "22222222-2222-4222-8222-222222222222";

const adminProfile = { id: "admin-user", role: "admin" as const };
const businessAdminProfile = { id: "ba-user", role: "business_admin" as const };

const exceptionId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

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

describe("date exception tag_type (phase 10c)", () => {
  const baseExceptionInput = {
    fishingSpotId: spotA,
    exceptionDate: "2026-06-24",
    isOpen: false,
    is24Hours: false,
    openTime: null,
    closeTime: null,
    note: null,
  };

  const savedException = {
    id: exceptionId,
    fishing_spot_id: spotA,
    exception_date: "2026-06-24",
    is_open: false,
    open_time: null,
    close_time: null,
    is_24_hours: false,
    note: null,
    ignore_weekly_breaks: false,
    tag_type: "temporary_closed",
    created_at: "",
    updated_at: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSpotBusinessIdBySpotId).mockResolvedValue(bizA);
  });

  it("例外日作成時に tagType を保存できる", async () => {
    vi.mocked(insertDateException).mockResolvedValue(savedException);

    const result = await createDateExceptionForSpot(adminProfile, {
      ...baseExceptionInput,
      tagType: "temporary_closed",
    });

    expect(result.ok).toBe(true);
    expect(insertDateException).toHaveBeenCalledWith(
      spotA,
      expect.objectContaining({ tag_type: "temporary_closed" }),
    );
  });

  it("例外日更新時に tagType を変更できる", async () => {
    vi.mocked(findDateExceptionSpotIdById).mockResolvedValue(spotA);
    vi.mocked(updateDateExceptionById).mockResolvedValue({
      ...savedException,
      tag_type: "event",
    });

    const result = await updateDateExceptionForSpot(adminProfile, exceptionId, {
      ...baseExceptionInput,
      exceptionId,
      isOpen: true,
      openTime: "09:00",
      closeTime: "17:00",
      tagType: "event",
    });

    expect(result.ok).toBe(true);
    expect(updateDateExceptionById).toHaveBeenCalledWith(
      exceptionId,
      expect.objectContaining({ tag_type: "event" }),
    );
  });

  it("tagType 未指定でも保存できる", async () => {
    vi.mocked(insertDateException).mockResolvedValue({
      ...savedException,
      tag_type: null,
    });

    const result = await createDateExceptionForSpot(adminProfile, baseExceptionInput);

    expect(result.ok).toBe(true);
    expect(insertDateException).toHaveBeenCalledWith(
      spotA,
      expect.objectContaining({ tag_type: null }),
    );
  });

  it("business_admin が担当外 spot の例外日を保存しようとすると拒否する", async () => {
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizA]);
    vi.mocked(findSpotBusinessIdBySpotId).mockResolvedValue(bizB);

    const result = await createDateExceptionForSpot(businessAdminProfile, {
      ...baseExceptionInput,
      tagType: "temporary_closed",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
    expect(insertDateException).not.toHaveBeenCalled();
  });
});

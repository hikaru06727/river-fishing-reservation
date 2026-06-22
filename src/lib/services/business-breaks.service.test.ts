import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: vi.fn(),
  findSpotBusinessIdBySpotId: vi.fn(),
}));

vi.mock("@/lib/repositories/business-hours.repository", () => ({
  findDateExceptionsBySpotId: vi.fn(),
  updateDateExceptionById: vi.fn(),
}));

vi.mock("@/lib/repositories/business-breaks.repository", () => ({
  findExceptionBreakSpotIdByExceptionId: vi.fn(),
  replaceExceptionBreaksForException: vi.fn(),
  replaceWeeklyBreaksForSpot: vi.fn(),
}));

import { findAssignedBusinessIdsByUserId, findSpotBusinessIdBySpotId } from "@/lib/repositories/businesses.repository";
import {
  findDateExceptionsBySpotId,
  updateDateExceptionById,
} from "@/lib/repositories/business-hours.repository";
import {
  findExceptionBreakSpotIdByExceptionId,
  replaceExceptionBreaksForException,
  replaceWeeklyBreaksForSpot,
} from "@/lib/repositories/business-breaks.repository";
import { saveExceptionBreaksForSpot, saveWeeklyBreaksForSpot } from "./business-breaks.service";

const spotA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bizA = "11111111-1111-4111-8111-111111111111";
const bizB = "22222222-2222-4222-8222-222222222222";
const exceptionId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

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

const existingException = {
  id: exceptionId,
  location_id: spotA,
  exception_date: "2026-06-24",
  is_open: true,
  open_time: "09:00:00",
  close_time: "17:00:00",
  is_24_hours: false,
  note: "イベント日",
  ignore_weekly_breaks: false,
  tag_type: "event",
  created_at: "",
  updated_at: "",
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

describe("saveExceptionBreaksForSpot tag_type preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findExceptionBreakSpotIdByExceptionId).mockResolvedValue(spotA);
    vi.mocked(findDateExceptionsBySpotId).mockResolvedValue([existingException]);
    vi.mocked(replaceExceptionBreaksForException).mockResolvedValue([]);
    vi.mocked(updateDateExceptionById).mockResolvedValue(existingException);
  });

  it("ignore_weekly_breaks 更新時に tag_type を引き継ぐ", async () => {
    const result = await saveExceptionBreaksForSpot(adminProfile, {
      fishingSpotId: spotA,
      exceptionId,
      ignoreWeeklyBreaks: true,
      breaks: [],
    });

    expect(result.ok).toBe(true);
    expect(updateDateExceptionById).toHaveBeenCalledWith(
      exceptionId,
      expect.objectContaining({
        tag_type: "event",
        ignore_weekly_breaks: true,
      }),
    );
  });
});

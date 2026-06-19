import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/repositories/plans.repository", () => ({
  findActivePlanForReservation: vi.fn(),
}));

vi.mock("@/lib/repositories/slots.repository", () => ({
  findSlotById: vi.fn(),
}));

vi.mock("@/lib/repositories/reservations.repository", () => ({
  createReservationAtomic: vi.fn(),
  findSpotNotificationMetaById: vi.fn(),
  insertPendingPaymentForReservation: vi.fn(),
}));

vi.mock("@/lib/slots/affected-slots", () => ({
  fetchAffectedSlots: vi.fn(),
  getAffectedSlotStartTimes: vi.fn(),
  validateAffectedSlotsCapacity: vi.fn(),
}));

vi.mock("@/lib/email/reservation-emails", () => ({
  sendReservationCreatedEmails: vi.fn().mockResolvedValue(undefined),
}));

import { findActivePlanForReservation } from "@/lib/repositories/plans.repository";
import {
  createReservationAtomic,
  findSpotNotificationMetaById,
  insertPendingPaymentForReservation,
} from "@/lib/repositories/reservations.repository";
import { findSlotById } from "@/lib/repositories/slots.repository";
import {
  fetchAffectedSlots,
  getAffectedSlotStartTimes,
  validateAffectedSlotsCapacity,
} from "@/lib/slots/affected-slots";
import { createReservation } from "./reservations.service";
import type { Plan } from "@/types/database";

const spotA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const spotB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const planA = "11111111-1111-4111-8111-111111111111";
const planB = "22222222-2222-4222-8222-222222222222";
const slotId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";

function makePlan(overrides: Partial<Plan> & Pick<Plan, "id">): Plan {
  return {
    name: "テストプラン",
    slug: "1h",
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
    ...overrides,
  };
}

const validInput = {
  spotId: spotA,
  planId: planA,
  slotId,
  reservationDate: "2026-06-20",
  guestCount: 2,
  paymentMethod: "cash_at_venue" as const,
};

describe("createReservation plan/spot validation (phase 8a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, fishing_spot_id: spotA }),
    );
    vi.mocked(findSlotById).mockResolvedValue({
      id: slotId,
      spot_id: spotA,
      slot_date: "2026-06-20",
      start_time: "09:00:00",
      end_time: "09:59:00",
      max_capacity: 5,
      booked_count: 0,
      status: "open",
    });
    vi.mocked(getAffectedSlotStartTimes).mockReturnValue(["09:00:00"]);
    vi.mocked(fetchAffectedSlots).mockResolvedValue({
      slots: [
        {
          id: slotId,
          spot_id: spotA,
          slot_date: "2026-06-20",
          start_time: "09:00:00",
          end_time: "09:59:00",
          max_capacity: 5,
          booked_count: 0,
          status: "open",
        },
      ],
      error: null,
    });
    vi.mocked(validateAffectedSlotsCapacity).mockReturnValue({ valid: true });
    vi.mocked(createReservationAtomic).mockResolvedValue({
      reservation_id: "res-1",
      success: true,
      error_code: null,
      error_message: null,
    });
    vi.mocked(findSpotNotificationMetaById).mockResolvedValue({
      name: "テスト釣り場",
      slug: "test-spot",
      businessId: null,
    });
    vi.mocked(insertPendingPaymentForReservation).mockResolvedValue(undefined);
  });

  it("spot A の予約で spot B の planId を使えない", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(null);

    const result = await createReservation(userId, {
      ...validInput,
      planId: planB,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("プランが見つかりません");
    }
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });

  it("is_accepting_reservations=false のプランでは予約できない", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(null);

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(false);
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });

  it("guest_count > plan.max_guests の場合は拒否される", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, max_guests: 2 }),
    );

    const result = await createReservation(userId, {
      ...validInput,
      guestCount: 3,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("2名以下");
    }
    expect(createReservationAtomic).not.toHaveBeenCalled();
  });

  it("legacy 共通プランは移行期間中 cash_at_venue で作成できる", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({ id: planA, fishing_spot_id: null, slug: "1h" }),
    );

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(true);
    expect(createReservationAtomic).toHaveBeenCalledOnce();
    expect(insertPendingPaymentForReservation).toHaveBeenCalledOnce();
  });

  it("任意 slug でも duration_minutes が正しければ予約できる", async () => {
    vi.mocked(findActivePlanForReservation).mockResolvedValue(
      makePlan({
        id: planA,
        slug: "spot-custom-2h",
        duration_minutes: 120,
      }),
    );
    vi.mocked(getAffectedSlotStartTimes).mockReturnValue(["09:00:00", "10:00:00"]);

    const result = await createReservation(userId, validInput);

    expect(result.ok).toBe(true);
    expect(createReservationAtomic).toHaveBeenCalledOnce();
  });
});

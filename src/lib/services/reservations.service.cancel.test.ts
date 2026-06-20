import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const {
  findReservationByIdForUserMock,
  findReservationByIdAdminMock,
  cancelReservationAtomicMock,
  findSpotNotificationMetaByIdMock,
  findPlanByIdMock,
  findSlotByIdAdminMock,
  fetchAffectedSlotsMock,
} = vi.hoisted(() => ({
  findReservationByIdForUserMock: vi.fn(),
  findReservationByIdAdminMock: vi.fn(),
  cancelReservationAtomicMock: vi.fn(),
  findSpotNotificationMetaByIdMock: vi.fn(),
  findPlanByIdMock: vi.fn(),
  findSlotByIdAdminMock: vi.fn(),
  fetchAffectedSlotsMock: vi.fn(),
}));

vi.mock("@/lib/slots/affected-slots", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/slots/affected-slots")>();
  return {
    ...actual,
    fetchAffectedSlots: fetchAffectedSlotsMock,
  };
});

vi.mock("@/lib/repositories/reservations.repository", () => ({
  findReservationByIdForUser: findReservationByIdForUserMock,
  findReservationByIdAdmin: findReservationByIdAdminMock,
  cancelReservationAtomic: cancelReservationAtomicMock,
  findSpotNotificationMetaById: findSpotNotificationMetaByIdMock,
}));

vi.mock("@/lib/repositories/plans.repository", () => ({
  findPlanById: findPlanByIdMock,
}));

vi.mock("@/lib/repositories/slots.repository", () => ({
  findSlotByIdAdmin: findSlotByIdAdminMock,
}));

vi.mock("@/lib/email/reservation-cancellation-emails", () => ({
  sendReservationCancelledEmails: vi.fn().mockResolvedValue(undefined),
}));

import { cancelReservation } from "./reservations.service";
import { getAffectedSlotStartTimes } from "@/lib/slots/affected-slots";

const userId = "44444444-4444-4444-8444-444444444444";
const reservationId = "55555555-5555-4555-8555-555555555555";
const slotId = "33333333-3333-4333-8333-333333333333";
const spotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const planId = "11111111-1111-4111-8111-111111111111";

function futureReservationDate(daysAhead = 14): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

const reservationDate = futureReservationDate();

const baseReservation = {
  id: reservationId,
  user_id: userId,
  spot_id: spotId,
  slot_id: slotId,
  plan_id: planId,
  reservation_date: reservationDate,
  start_time: "09:00:00",
  end_time: "11:00:00",
  guest_count: 2,
  status: "confirmed" as const,
  payment_method: "cash_at_venue" as const,
  reserved_plan_name: "清流2時間",
  reserved_unit_price_yen: 5000,
  reserved_duration_minutes: 120,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  expires_at: null,
  expired_email_sent_at: null,
};

describe("cancelReservation reserved_duration_minutes (phase 8d)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    findReservationByIdForUserMock.mockResolvedValue(baseReservation);
    findSlotByIdAdminMock.mockResolvedValue({
      id: slotId,
      spot_id: spotId,
      slot_date: reservationDate,
      start_time: "09:00:00",
      end_time: "09:59:00",
      max_capacity: 5,
      booked_count: 2,
      status: "open",
    });
    findPlanByIdMock.mockResolvedValue({
      id: planId,
      name: "変更後プラン",
      slug: "seiryu-2h",
      duration_minutes: 999,
      price_yen: 9999,
      fishing_spot_id: spotId,
      is_active: true,
      is_visible: true,
      is_accepting_reservations: true,
      max_guests: 4,
      description: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    findSpotNotificationMetaByIdMock.mockResolvedValue({
      name: "テスト釣り場",
      slug: "test-spot",
      businessId: null,
    });
    cancelReservationAtomicMock.mockResolvedValue({
      success: true,
      reservation_id: reservationId,
      error_code: null,
      error_message: null,
    });
    fetchAffectedSlotsMock.mockImplementation(
      async (_spotId: string, _date: string, startTimes: string[]) => ({
      slots: startTimes.map((startTime: string, index: number) => ({
        id: `slot-${index}`,
        spot_id: spotId,
        slot_date: reservationDate,
        start_time: `${startTime}:00`,
        end_time: "09:59:00",
        max_capacity: 5,
        booked_count: 2,
        status: "open",
      })),
      error: null,
      }),
    );
  });

  it("live plan.duration を変更しても reserved_duration_minutes の範囲だけ RPC に渡す", async () => {
    const result = await cancelReservation(userId, { reservationId });

    expect(result.ok).toBe(true);
    expect(fetchAffectedSlotsMock).toHaveBeenCalledWith(
      spotId,
      reservationDate,
      ["09:00", "10:00"],
    );
    expect(cancelReservationAtomicMock).toHaveBeenCalledTimes(1);

    const rpcArgs = cancelReservationAtomicMock.mock.calls[0]![0];
    expect(rpcArgs.affected_slot_ids).toEqual(["slot-0", "slot-1"]);
    expect(rpcArgs.guest_count).toBe(2);

    const wrongStartTimes = getAffectedSlotStartTimes("09:00:00", 999);
    expect(wrongStartTimes.length).toBeGreaterThan(2);
  });

  it("プランが削除されていても snapshot duration があればキャンセルできる", async () => {
    findPlanByIdMock.mockResolvedValue(null);

    const result = await cancelReservation(userId, { reservationId });

    expect(result.ok).toBe(true);
    expect(cancelReservationAtomicMock).toHaveBeenCalled();
  });

  it("reserved_duration_minutes が NULL の場合は start/end から duration を算出する", async () => {
    findReservationByIdForUserMock.mockResolvedValue({
      ...baseReservation,
      reserved_duration_minutes: null,
    });

    const result = await cancelReservation(userId, { reservationId });

    expect(result.ok).toBe(true);
    const rpcArgs = cancelReservationAtomicMock.mock.calls[0]![0];
    expect(rpcArgs.affected_slot_ids).toHaveLength(2);
  });

  it("duration を解決できない場合は 500 を返す", async () => {
    findReservationByIdForUserMock.mockResolvedValue({
      ...baseReservation,
      reserved_duration_minutes: null,
      start_time: "09:00:00",
      end_time: "09:00:00",
    });

    const result = await cancelReservation(userId, { reservationId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
    expect(cancelReservationAtomicMock).not.toHaveBeenCalled();
  });
});

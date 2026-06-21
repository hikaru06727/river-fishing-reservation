import { beforeEach, describe, expect, it, vi } from "vitest";
import { addMinutes } from "@/lib/utils/date";
import { LEGACY_SLOT_STEP_MINUTES, SLOT_STEP_MINUTES } from "@/lib/slots/slot-step";

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

function makeStartSlot(
  startTime: string,
  slotStepMinutes: typeof LEGACY_SLOT_STEP_MINUTES | typeof SLOT_STEP_MINUTES,
) {
  const startNorm = startTime.slice(0, 5);
  const endNorm = addMinutes(startNorm, slotStepMinutes);
  return {
    id: slotId,
    spot_id: spotId,
    slot_date: reservationDate,
    start_time: `${startNorm}:00`,
    end_time: `${endNorm}:00`,
    max_capacity: 5,
    booked_count: 2,
    status: "open" as const,
  };
}

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

function mockFetchAffectedSlotsFromStartTimes(
  startTimes: string[],
  slotStepMinutes: typeof LEGACY_SLOT_STEP_MINUTES | typeof SLOT_STEP_MINUTES,
) {
  fetchAffectedSlotsMock.mockResolvedValue({
    slots: startTimes.map((startTime, index) => {
      const startNorm = startTime.slice(0, 5);
      const endNorm = addMinutes(startNorm, slotStepMinutes);
      return {
        id: `slot-${index}`,
        spot_id: spotId,
        slot_date: reservationDate,
        start_time: `${startNorm}:00`,
        end_time: `${endNorm}:00`,
        max_capacity: 5,
        booked_count: 2,
        status: "open",
      };
    }),
    error: null,
  });
}

describe("cancelReservation reserved_duration_minutes (phase 8d)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    findReservationByIdForUserMock.mockResolvedValue(baseReservation);
    findSlotByIdAdminMock.mockResolvedValue(makeStartSlot("09:00", LEGACY_SLOT_STEP_MINUTES));
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
    mockFetchAffectedSlotsFromStartTimes(["09:00", "10:00"], LEGACY_SLOT_STEP_MINUTES);
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

    const wrongStartTimes = getAffectedSlotStartTimes("09:00:00", 960, LEGACY_SLOT_STEP_MINUTES);
    expect(wrongStartTimes.length).toBe(16);
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

describe("cancelReservation dual-path (phase 9d-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    findReservationByIdForUserMock.mockResolvedValue(baseReservation);
    findSlotByIdAdminMock.mockResolvedValue(makeStartSlot("09:00", LEGACY_SLOT_STEP_MINUTES));
    findPlanByIdMock.mockResolvedValue(null);
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
    mockFetchAffectedSlotsFromStartTimes(["09:00", "10:00"], LEGACY_SLOT_STEP_MINUTES);
  });

  it("legacy hourly 09:00 / 2h → affected slot ids が 2 件", async () => {
    const result = await cancelReservation(userId, { reservationId });

    expect(result.ok).toBe(true);
    expect(cancelReservationAtomicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        affected_slot_ids: ["slot-0", "slot-1"],
      }),
    );
  });

  it("15分予約 09:15 / 2h → affected slot ids が 8 件", async () => {
    const startTimes = [
      "09:15",
      "09:30",
      "09:45",
      "10:00",
      "10:15",
      "10:30",
      "10:45",
      "11:00",
    ];
    findReservationByIdForUserMock.mockResolvedValue({
      ...baseReservation,
      start_time: "09:15:00",
      end_time: "11:15:00",
    });
    findSlotByIdAdminMock.mockResolvedValue(makeStartSlot("09:15", SLOT_STEP_MINUTES));
    mockFetchAffectedSlotsFromStartTimes(startTimes, SLOT_STEP_MINUTES);

    const result = await cancelReservation(userId, { reservationId });

    expect(result.ok).toBe(true);
    expect(fetchAffectedSlotsMock).toHaveBeenCalledWith(spotId, reservationDate, startTimes);
    expect(cancelReservationAtomicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        affected_slot_ids: startTimes.map((_, index) => `slot-${index}`),
      }),
    );
  });

  it("snapshot duration が優先される（live plan 999 分でも 2 枠）", async () => {
    findPlanByIdMock.mockResolvedValue({
      id: planId,
      name: "変更後プラン",
      slug: "changed",
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

    const result = await cancelReservation(userId, { reservationId });

    expect(result.ok).toBe(true);
    expect(cancelReservationAtomicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        affected_slot_ids: ["slot-0", "slot-1"],
      }),
    );
  });

  it("affected slot が欠けている場合は部分キャンセルしない", async () => {
    fetchAffectedSlotsMock.mockResolvedValue({
      slots: [
        {
          id: "slot-0",
          spot_id: spotId,
          slot_date: reservationDate,
          start_time: "09:00:00",
          end_time: "10:00:00",
          max_capacity: 5,
          booked_count: 2,
          status: "open",
        },
      ],
      error: null,
    });

    const result = await cancelReservation(userId, { reservationId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
    expect(cancelReservationAtomicMock).not.toHaveBeenCalled();
  });

  it("duration % step !== 0 の場合はキャンセル不可", async () => {
    findReservationByIdForUserMock.mockResolvedValue({
      ...baseReservation,
      reserved_duration_minutes: 100,
    });
    findSlotByIdAdminMock.mockResolvedValue(makeStartSlot("09:15", SLOT_STEP_MINUTES));

    const result = await cancelReservation(userId, { reservationId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
    expect(cancelReservationAtomicMock).not.toHaveBeenCalled();
  });

  it("admin キャンセルは findReservationByIdAdmin を使い dual-path を維持する", async () => {
    findReservationByIdForUserMock.mockResolvedValue(null);
    findReservationByIdAdminMock.mockResolvedValue({
      ...baseReservation,
      status: "pending",
      payment_method: "online",
    });

    const result = await cancelReservation(
      userId,
      { reservationId },
      { isAdmin: true, cancelledBy: "admin" },
    );

    expect(result.ok).toBe(true);
    expect(findReservationByIdAdminMock).toHaveBeenCalledWith(reservationId);
    expect(findReservationByIdForUserMock).not.toHaveBeenCalled();
    expect(cancelReservationAtomicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        affected_slot_ids: ["slot-0", "slot-1"],
      }),
    );
  });

  it("legacy hourly 予約を 15分 step で戻さない", async () => {
    findSlotByIdAdminMock.mockResolvedValue(makeStartSlot("09:00", LEGACY_SLOT_STEP_MINUTES));

    await cancelReservation(userId, { reservationId });

    expect(fetchAffectedSlotsMock).toHaveBeenCalledWith(
      spotId,
      reservationDate,
      ["09:00", "10:00"],
    );
    expect(fetchAffectedSlotsMock).not.toHaveBeenCalledWith(
      spotId,
      reservationDate,
      expect.arrayContaining(["09:15"]),
    );
  });
});

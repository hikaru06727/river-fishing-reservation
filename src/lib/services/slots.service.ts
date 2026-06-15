import { unstable_noStore as noStore } from "next/cache";
import { addMinutes, toISODate } from "@/lib/utils/date";
import { findActivePlanById } from "@/lib/repositories/plans.repository";
import { findOpenSlotsBySpotAndDateRange } from "@/lib/repositories/slots.repository";
import {
  getAffectedSlotStartTimes,
  validateAffectedSlotsCapacity,
  type AffectedSlot,
} from "@/lib/slots/affected-slots";
import { computeRemainingCount } from "@/lib/slots/remaining-count";
import type { GetAvailableSlotsWithPlanResponse, SlotDTO } from "@/types/api";
import { isAllowedStartTime } from "@/validations/reservation";

export type GetAvailableSlotsWithPlanParams = {
  spotId: string;
  planId: string;
  guestCount?: number;
  date?: string;
};

function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

function slotMapKey(slotDate: string, startTime: string): string {
  return `${slotDate}:${normalizeTime(startTime)}`;
}

function toAffectedSlot(row: {
  id: string;
  spot_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  booked_count: number;
  max_capacity: number;
  status: string;
}): AffectedSlot {
  return {
    id: row.id,
    spot_id: row.spot_id,
    slot_date: row.slot_date,
    start_time: row.start_time,
    end_time: row.end_time,
    booked_count: row.booked_count,
    max_capacity: row.max_capacity,
    status: row.status,
  };
}

/**
 * プラン時間を考慮した予約可能スロット一覧（API の唯一のソース）。
 *
 * レスポンスは `{ plan, guest_count, slots[] }` のフラット構造。
 * `remaining_count` は {@link computeRemainingCount} でのみ算出する。
 */
export async function getAvailableSlotsWithPlan(
  params: GetAvailableSlotsWithPlanParams,
): Promise<GetAvailableSlotsWithPlanResponse> {
  noStore();

  const guestCount = params.guestCount ?? 1;
  const plan = await findActivePlanById(params.planId);

  if (!plan) {
    throw new Error("プランが見つかりません");
  }

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 6);

  const startDate = params.date ?? toISODate(today);
  const rangeEnd = params.date ?? toISODate(endDate);

  const allSlots = await findOpenSlotsBySpotAndDateRange(
    params.spotId,
    startDate,
    rangeEnd,
  );

  const slotMap = new Map<string, (typeof allSlots)[number]>();
  for (const slot of allSlots) {
    slotMap.set(slotMapKey(slot.slot_date, slot.start_time), slot);
  }

  const bookableSlots: SlotDTO[] = [];

  for (const candidate of allSlots) {
    if (!isAllowedStartTime(plan.slug, candidate.start_time)) {
      continue;
    }

    const affectedStartTimes = getAffectedSlotStartTimes(
      candidate.start_time,
      plan.duration_minutes,
    );

    const affectedSlots: AffectedSlot[] = [];

    for (const time of affectedStartTimes) {
      const row = slotMap.get(slotMapKey(candidate.slot_date, time));
      if (row) {
        affectedSlots.push(toAffectedSlot(row));
      }
    }

    const validation = validateAffectedSlotsCapacity(
      affectedSlots,
      affectedStartTimes,
      guestCount,
    );

    if (!validation.valid) {
      continue;
    }

    bookableSlots.push({
      id: candidate.id,
      date: candidate.slot_date,
      start_time: normalizeTime(candidate.start_time),
      end_time: addMinutes(normalizeTime(candidate.start_time), plan.duration_minutes),
      remaining_count: computeRemainingCount(affectedSlots),
      affected_slot_ids: affectedSlots.map((s) => s.id),
    });
  }

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      duration_minutes: plan.duration_minutes,
      price_yen: plan.price_yen,
    },
    guest_count: guestCount,
    slots: bookableSlots,
  };
}

import { unstable_noStore as noStore } from "next/cache";
import { addMinutes, toISODate } from "@/lib/utils/date";
import {
  getEffectiveBusinessHoursForDate,
  hasBusinessHoursConfigured,
  isReservationWithinBusinessHours,
} from "@/lib/business-hours/effective-hours";
import {
  getEffectiveBreaksForDate,
  hasBreaksConfigured,
  isReservationOverlappingBreaks,
} from "@/lib/business-hours/effective-breaks";
import {
  findExceptionBreaksBySpotAndDateRange,
  findWeeklyBreaksBySpotId,
} from "@/lib/repositories/business-breaks.repository";
import {
  findDateExceptionsBySpotAndDateRange,
  findWeeklyHoursBySpotId,
} from "@/lib/repositories/business-hours.repository";
import { findActivePlanForReservation } from "@/lib/repositories/plans.repository";
import { findOpenSlotsBySpotAndDateRange } from "@/lib/repositories/slots.repository";
import {
  getAffectedSlotStartTimes,
  validateAffectedSlotsCapacity,
  type AffectedSlot,
} from "@/lib/slots/affected-slots";
import {
  LEGACY_SLOT_STEP_MINUTES,
  slotStepMinutesFromSlotRow,
} from "@/lib/slots/slot-step";
import { computeRemainingCount } from "@/lib/slots/remaining-count";
import type { GetAvailableSlotsWithPlanResponse, SlotDTO } from "@/types/api";
import { AVAILABLE_SLOT_LOOKAHEAD_DAYS } from "@/lib/slots/availability-lookahead";
import { isAllowedLegacyHourlyStartTimeByDuration } from "@/lib/slots/start-time-rules";

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
 * 候補可否は availability_slots の行を基準に判定する。
 * - step は各行の (end_time - start_time) から導出
 * - 15分 grid: affected slots がすべて存在し capacity が足りれば候補（営業時間は slot データに委ねる）
 * - legacy hourly: 上記に加え LEGACY_BOOKABLE_HOUR_SLOTS 互換フィルタを適用
 *
 * レスポンスは `{ plan, guest_count, slots[] }` のフラット構造。
 * `remaining_count` は {@link computeRemainingCount} でのみ算出する。
 */
export async function getAvailableSlotsWithPlan(
  params: GetAvailableSlotsWithPlanParams,
): Promise<GetAvailableSlotsWithPlanResponse> {
  noStore();

  const guestCount = params.guestCount ?? 1;
  const plan = await findActivePlanForReservation(params.planId, params.spotId);

  if (!plan) {
    throw new Error("プランが見つかりません");
  }

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + AVAILABLE_SLOT_LOOKAHEAD_DAYS);

  const startDate = params.date ?? toISODate(today);
  const rangeEnd = params.date ?? toISODate(endDate);

  const allSlots = await findOpenSlotsBySpotAndDateRange(
    params.spotId,
    startDate,
    rangeEnd,
  );

  const weeklyHours = await findWeeklyHoursBySpotId(params.spotId);
  const businessHoursConfigured = hasBusinessHoursConfigured(weeklyHours);
  const dateExceptions = businessHoursConfigured
    ? await findDateExceptionsBySpotAndDateRange(params.spotId, startDate, rangeEnd)
    : [];
  const weeklyBreaks = businessHoursConfigured
    ? await findWeeklyBreaksBySpotId(params.spotId)
    : [];
  const exceptionBreakRows = businessHoursConfigured
    ? await findExceptionBreaksBySpotAndDateRange(params.spotId, startDate, rangeEnd)
    : [];
  const breaksConfigured = businessHoursConfigured
    ? hasBreaksConfigured(
        weeklyBreaks,
        exceptionBreakRows.map((row) => ({
          date_exception_id: row.date_exception_id,
          start_time: row.start_time,
          end_time: row.end_time,
          label: row.label,
        })),
      )
    : false;
  const dateExceptionsWithBreakMeta = dateExceptions.map((row) => ({
    id: row.id,
    exception_date: row.exception_date,
    is_open: row.is_open,
    open_time: row.open_time,
    close_time: row.close_time,
    is_24_hours: row.is_24_hours,
    note: row.note,
    ignore_weekly_breaks: row.ignore_weekly_breaks,
  }));

  const slotMap = new Map<string, (typeof allSlots)[number]>();
  for (const slot of allSlots) {
    slotMap.set(slotMapKey(slot.slot_date, slot.start_time), slot);
  }

  const bookableSlots: SlotDTO[] = [];

  for (const candidate of allSlots) {
    const slotStepMinutes = slotStepMinutesFromSlotRow(
      candidate.start_time,
      candidate.end_time,
    );
    if (slotStepMinutes === null) {
      continue;
    }

    if (plan.duration_minutes % slotStepMinutes !== 0) {
      continue;
    }

    if (slotStepMinutes === LEGACY_SLOT_STEP_MINUTES) {
      if (
        !isAllowedLegacyHourlyStartTimeByDuration(
          plan.duration_minutes,
          candidate.start_time,
        )
      ) {
        continue;
      }
    }

    const affectedStartTimes = getAffectedSlotStartTimes(
      candidate.start_time,
      plan.duration_minutes,
      slotStepMinutes,
    );

    if (affectedStartTimes.length === 0) {
      continue;
    }

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

    if (businessHoursConfigured) {
      const effective = getEffectiveBusinessHoursForDate(
        weeklyHours,
        dateExceptions,
        candidate.slot_date,
      );
      if (
        !isReservationWithinBusinessHours(
          effective,
          candidate.start_time,
          plan.duration_minutes,
        )
      ) {
        continue;
      }

      if (breaksConfigured) {
        const breaks = getEffectiveBreaksForDate(
          weeklyBreaks,
          exceptionBreakRows.map((row) => ({
            date_exception_id: row.date_exception_id,
            start_time: row.start_time,
            end_time: row.end_time,
            label: row.label,
          })),
          dateExceptionsWithBreakMeta,
          candidate.slot_date,
        );
        if (
          isReservationOverlappingBreaks(
            candidate.start_time,
            plan.duration_minutes,
            breaks,
          )
        ) {
          continue;
        }
      }
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

import type { SupabaseClient } from "@supabase/supabase-js";
import { findSlotsBySpotDateAndStartTimes } from "@/lib/repositories/slots.repository";
import { isSupportedSlotStepMinutes } from "@/lib/slots/slot-step";
import { getSlotRemainingCapacity } from "@/lib/slots/remaining-count";
import { addMinutes, toDbTime } from "@/lib/utils/date";
import type { Database } from "@/types/database";
type AdminClient = SupabaseClient<Database>;

export type AffectedSlot = {
  id: string;
  spot_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  booked_count: number;
  max_capacity: number;
  status: string;
};

export type SlotUpdateLog = {
  slotId: string;
  startTime: string;
  bookedCountBefore: number;
  bookedCountAfter: number;
  success: boolean;
  error: string | null;
};

/**
 * プラン時間と slot step から、影響する availability_slots の start_time 一覧を返す。
 * 例: 09:15 + 120min + 15min step → 09:15, 09:30, …, 11:00
 */
export function getAffectedSlotStartTimes(
  startTime: string,
  durationMinutes: number,
  slotStepMinutes: number,
): string[] {
  if (durationMinutes <= 0) {
    return [];
  }

  if (!isSupportedSlotStepMinutes(slotStepMinutes)) {
    return [];
  }

  if (durationMinutes % slotStepMinutes !== 0) {
    return [];
  }

  const slotCount = durationMinutes / slotStepMinutes;
  const base = startTime.slice(0, 5);
  const times: string[] = [];

  for (let i = 0; i < slotCount; i++) {
    times.push(addMinutes(base, i * slotStepMinutes));
  }

  return times;
}

function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

/** 影響を受ける availability_slots を取得（repository 経由） */
export async function fetchAffectedSlots(
  spotId: string,
  slotDate: string,
  startTimes: string[],
): Promise<{ slots: AffectedSlot[]; error: string | null }> {
  try {
    const rows = await findSlotsBySpotDateAndStartTimes(spotId, slotDate, startTimes);
    return { slots: rows as AffectedSlot[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { slots: [], error: message };
  }
}

/** 全スロットに十分な残枠があるか検証 */
export function validateAffectedSlotsCapacity(
  slots: AffectedSlot[],
  expectedStartTimes: string[],
  guestCount: number,
): { valid: true } | { valid: false; message: string } {
  if (slots.length !== expectedStartTimes.length) {
    const found = new Set(slots.map((s) => normalizeTime(s.start_time)));
    const missing = expectedStartTimes.filter((t) => !found.has(t));
    return {
      valid: false,
      message:
        missing.length > 0
          ? `${missing.join(", ")} の空き枠が見つかりません。プラン時間に対応する連続枠が必要です。`
          : "必要な空き枠数と一致しません。",
    };
  }

  for (const expected of expectedStartTimes) {
    const slot = slots.find((s) => normalizeTime(s.start_time) === expected);

    if (!slot) {
      return { valid: false, message: `${expected} の空き枠が見つかりません。` };
    }

    if (slot.status !== "open") {
      return { valid: false, message: `${expected} の枠は現在予約できません。` };
    }

    const remaining = getSlotRemainingCapacity(slot);
    if (guestCount > remaining) {
      return {
        valid: false,
        message: `${expected} の残り枠は ${remaining} 名です（${guestCount} 名は予約できません）。`,
      };
    }
  }

  return { valid: true };
}

/** @deprecated create_reservation_atomic RPC を使用すること。非原子的な更新のため本番予約では使わない */
export async function incrementAffectedSlots(  admin: AdminClient,
  slots: AffectedSlot[],
  guestCount: number,
  logPrefix: string,
): Promise<{ ok: true; logs: SlotUpdateLog[] } | { ok: false; error: string; logs: SlotUpdateLog[] }> {
  const logs: SlotUpdateLog[] = [];
  const completed: Array<{ id: string; previousBookedCount: number }> = [];

  console.log(`${logPrefix} affected slot ids:`, slots.map((s) => s.id));

  for (const slot of slots) {
    const bookedCountBefore = slot.booked_count;
    const bookedCountAfter = bookedCountBefore + guestCount;

    const { data: updated, error } = await admin
      .from("availability_slots")
      .update({ booked_count: bookedCountAfter })
      .eq("id", slot.id)
      .eq("booked_count", bookedCountBefore)
      .select("id, start_time, booked_count, max_capacity")
      .maybeSingle();

    const log: SlotUpdateLog = {
      slotId: slot.id,
      startTime: normalizeTime(slot.start_time),
      bookedCountBefore,
      bookedCountAfter,
      success: !error && !!updated,
      error: error?.message ?? null,
    };
    logs.push(log);

    console.log(`${logPrefix} slot UPDATE result:`, log);

    if (error || !updated) {
      console.error(`${logPrefix} slot UPDATE failed — rolling back ${completed.length} slot(s)`);

      for (const done of completed) {
        await admin
          .from("availability_slots")
          .update({ booked_count: done.previousBookedCount })
          .eq("id", done.id);
      }

      return {
        ok: false,
        error: `${normalizeTime(slot.start_time)} の空き枠更新に失敗しました。`,
        logs,
      };
    }

    completed.push({ id: slot.id, previousBookedCount: bookedCountBefore });
  }

  return { ok: true, logs };
}

/** @deprecated cancel_reservation_atomic RPC を使用すること。非原子的な更新のため本番キャンセルでは使わない */
export async function decrementAffectedSlots(  admin: AdminClient,
  slots: AffectedSlot[],
  guestCount: number,
  logPrefix: string,
): Promise<{ ok: true; logs: SlotUpdateLog[] } | { ok: false; error: string; logs: SlotUpdateLog[] }> {
  const logs: SlotUpdateLog[] = [];
  const completed: Array<{ id: string; previousBookedCount: number }> = [];

  console.log(`${logPrefix} affected slot ids:`, slots.map((s) => s.id));

  for (const slot of slots) {
    const bookedCountBefore = slot.booked_count;
    const bookedCountAfter = Math.max(0, bookedCountBefore - guestCount);

    const { data: updated, error } = await admin
      .from("availability_slots")
      .update({ booked_count: bookedCountAfter })
      .eq("id", slot.id)
      .eq("booked_count", bookedCountBefore)
      .select("id, start_time, booked_count, max_capacity")
      .maybeSingle();

    const log: SlotUpdateLog = {
      slotId: slot.id,
      startTime: normalizeTime(slot.start_time),
      bookedCountBefore,
      bookedCountAfter,
      success: !error && !!updated,
      error: error?.message ?? null,
    };
    logs.push(log);

    console.log(`${logPrefix} slot UPDATE result:`, log);

    if (error || !updated) {
      console.error(`${logPrefix} slot UPDATE failed — rolling back ${completed.length} slot(s)`);

      for (const done of completed) {
        await admin
          .from("availability_slots")
          .update({ booked_count: done.previousBookedCount })
          .eq("id", done.id);
      }

      return {
        ok: false,
        error: `${normalizeTime(slot.start_time)} の空き枠更新に失敗しました。`,
        logs,
      };
    }

    completed.push({ id: slot.id, previousBookedCount: bookedCountBefore });
  }

  return { ok: true, logs };
}

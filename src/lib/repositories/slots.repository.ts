import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { toDbTime } from "@/lib/utils/date";
import type { AvailabilitySlot, Plan } from "@/types/database";

export type SlotRow = Pick<
  AvailabilitySlot,
  | "id"
  | "spot_id"
  | "slot_date"
  | "start_time"
  | "end_time"
  | "max_capacity"
  | "booked_count"
  | "status"
>;

export async function findOpenSlotsBySpotAndDateRange(
  spotId: string,
  startDate: string,
  endDate: string,
): Promise<SlotRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_slots")
    .select(
      "id, spot_id, slot_date, start_time, end_time, max_capacity, booked_count, status",
    )
    .eq("spot_id", spotId)
    .eq("status", "open")
    .gte("slot_date", startDate)
    .lte("slot_date", endDate)
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SlotRow[];
}

export async function findSlotsBySpotDateAndStartTimes(
  spotId: string,
  slotDate: string,
  startTimes: string[],
): Promise<SlotRow[]> {
  const admin = createAdminClient();
  const dbTimes = startTimes.map(toDbTime);

  const { data, error } = await admin
    .from("availability_slots")
    .select(
      "id, spot_id, slot_date, start_time, end_time, max_capacity, booked_count, status",
    )
    .eq("spot_id", spotId)
    .eq("slot_date", slotDate)
    .in("start_time", dbTimes)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SlotRow[];
}

export async function findSlotById(
  slotId: string,
  spotId?: string,
): Promise<SlotRow | null> {
  const supabase = await createClient();

  let query = supabase
    .from("availability_slots")
    .select(
      "id, spot_id, slot_date, start_time, end_time, max_capacity, booked_count, status",
    )
    .eq("id", slotId);

  if (spotId) {
    query = query.eq("spot_id", spotId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as SlotRow | null;
}

export async function findSlotByIdAdmin(slotId: string): Promise<SlotRow | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("availability_slots")
    .select(
      "id, spot_id, slot_date, start_time, end_time, max_capacity, booked_count, status",
    )
    .eq("id", slotId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as SlotRow | null;
}

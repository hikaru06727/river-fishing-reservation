import { createClient } from "@/lib/supabase/server";
import type { BoothSlotRow } from "@/types/database";
import type { BoothSlotStatus } from "@/types/domain";

export type DateRange = {
  from: string;
  to: string;
};

export type InsertBoothSlotInput = {
  business_id: string;
  booth_id: string;
  date: string;
  start_time: string;
  end_time: string;
  max_bookings?: number;
  status?: BoothSlotStatus;
};

export async function findSlotsByBoothId(
  boothId: string,
  dateRange?: DateRange,
): Promise<BoothSlotRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("booth_slots")
    .select("*")
    .eq("booth_id", boothId)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (dateRange?.from) query = query.gte("date", dateRange.from);
  if (dateRange?.to) query = query.lte("date", dateRange.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as BoothSlotRow[];
}

export async function findSlotsByBusinessAndDate(
  businessId: string,
  date: string,
): Promise<BoothSlotRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booth_slots")
    .select("*")
    .eq("business_id", businessId)
    .eq("date", date)
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as BoothSlotRow[];
}

export async function findSlotById(id: string): Promise<BoothSlotRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booth_slots")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as BoothSlotRow | null;
}

export async function insertBoothSlots(inputs: InsertBoothSlotInput[]): Promise<BoothSlotRow[]> {
  if (inputs.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booth_slots")
    .insert(
      inputs.map((s) => ({
        business_id: s.business_id,
        booth_id: s.booth_id,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        max_bookings: s.max_bookings ?? 1,
        status: s.status ?? "open",
      })),
    )
    .select();

  if (error) throw new Error(error.message);
  return (data ?? []) as BoothSlotRow[];
}

export async function updateBoothSlotStatus(
  id: string,
  status: BoothSlotStatus,
): Promise<BoothSlotRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booth_slots")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BoothSlotRow;
}

export async function countBookingsForSlot(slotId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("booth_bookings")
    .select("id", { count: "exact", head: true })
    .eq("booth_slot_id", slotId)
    .neq("payment_status", "refunded");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

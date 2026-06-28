import { createClient } from "@/lib/supabase/server";
import type { BoothBookingRow } from "@/types/database";
import type { BoothBookingPaymentStatus, BoothBookingSource } from "@/types/domain";

export type InsertBoothBookingInput = {
  business_id: string;
  booth_slot_id: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  quantity?: number;
  unit_price: number;
  tax_rate: number;
  total_amount: number;
  payment_status?: BoothBookingPaymentStatus;
  source?: BoothBookingSource;
  notes?: string | null;
};

export type BookingFilters = {
  paymentStatus?: BoothBookingPaymentStatus;
  fromDate?: string;
  toDate?: string;
};

export async function findBookingsBySlotId(slotId: string): Promise<BoothBookingRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booth_bookings")
    .select("*")
    .eq("booth_slot_id", slotId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as BoothBookingRow[];
}

export async function findBookingsByBusinessId(
  businessId: string,
  filters: BookingFilters = {},
): Promise<BoothBookingRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("booth_bookings")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (filters.paymentStatus) {
    query = query.eq("payment_status", filters.paymentStatus);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as BoothBookingRow[];
}

export async function findBookingById(id: string): Promise<BoothBookingRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booth_bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as BoothBookingRow | null;
}

export async function insertBoothBooking(
  input: InsertBoothBookingInput,
): Promise<BoothBookingRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booth_bookings")
    .insert({
      business_id: input.business_id,
      booth_slot_id: input.booth_slot_id,
      customer_name: input.customer_name,
      customer_email: input.customer_email ?? null,
      customer_phone: input.customer_phone ?? null,
      quantity: input.quantity ?? 1,
      unit_price: input.unit_price,
      tax_rate: input.tax_rate,
      total_amount: input.total_amount,
      payment_status: input.payment_status ?? "pending",
      source: input.source ?? "pos",
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BoothBookingRow;
}

export async function updateBoothBookingPaymentStatus(
  id: string,
  paymentStatus: BoothBookingPaymentStatus,
): Promise<BoothBookingRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booth_bookings")
    .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BoothBookingRow;
}

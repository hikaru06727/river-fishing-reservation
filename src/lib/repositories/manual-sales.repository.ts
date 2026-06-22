import { createClient } from "@/lib/supabase/server";
import type { Database, ManualSale } from "@/types/database";

type ManualSaleUpdateRow = Database["public"]["Tables"]["manual_sales"]["Update"];

export type ManualSaleCategory = "bait" | "rental" | "parking" | "food" | "event" | "other";
export type ManualSalePaymentMethod = "cash" | "card" | "qr" | "other";

export type ManualSaleFilters = {
  locationId?: string;
  fromDate?: string;
  toDate?: string;
};

export type InsertManualSaleInput = {
  business_id: string;
  location_id?: string | null;
  sale_date: string;
  amount_yen: number;
  tax_rate_percent: number;
  category: ManualSaleCategory;
  payment_method: ManualSalePaymentMethod;
  description?: string | null;
  recorded_by: string;
};

export type UpdateManualSaleInput = {
  location_id?: string | null;
  sale_date?: string;
  amount_yen?: number;
  tax_rate_percent?: number;
  category?: ManualSaleCategory;
  payment_method?: ManualSalePaymentMethod;
  description?: string | null;
};

export async function findManualSalesByBusinessId(
  businessId: string,
  filters: ManualSaleFilters = {},
): Promise<ManualSale[]> {
  const supabase = await createClient();

  let query = supabase
    .from("manual_sales")
    .select("*")
    .eq("business_id", businessId)
    .order("sale_date", { ascending: false });

  if (filters.locationId) {
    query = query.eq("location_id", filters.locationId);
  }
  if (filters.fromDate) {
    query = query.gte("sale_date", filters.fromDate);
  }
  if (filters.toDate) {
    query = query.lte("sale_date", filters.toDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ManualSale[];
}

export async function findManualSaleById(id: string): Promise<ManualSale | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("manual_sales")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ManualSale | null;
}

export async function insertManualSale(input: InsertManualSaleInput): Promise<ManualSale> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("manual_sales")
    .insert({
      business_id: input.business_id,
      location_id: input.location_id ?? null,
      sale_date: input.sale_date,
      amount_yen: input.amount_yen,
      tax_rate_percent: input.tax_rate_percent,
      category: input.category,
      payment_method: input.payment_method,
      description: input.description ?? null,
      recorded_by: input.recorded_by,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ManualSale;
}

export async function updateManualSale(
  id: string,
  input: UpdateManualSaleInput,
): Promise<ManualSale> {
  const supabase = await createClient();

  const patch: ManualSaleUpdateRow = {};
  if (input.location_id !== undefined) patch.location_id = input.location_id;
  if (input.sale_date !== undefined) patch.sale_date = input.sale_date;
  if (input.amount_yen !== undefined) patch.amount_yen = input.amount_yen;
  if (input.tax_rate_percent !== undefined) patch.tax_rate_percent = input.tax_rate_percent;
  if (input.category !== undefined) patch.category = input.category;
  if (input.payment_method !== undefined) patch.payment_method = input.payment_method;
  if (input.description !== undefined) patch.description = input.description;

  const { data, error } = await supabase
    .from("manual_sales")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ManualSale;
}

export async function deleteManualSale(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("manual_sales").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

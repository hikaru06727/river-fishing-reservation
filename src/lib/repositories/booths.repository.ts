import { createClient } from "@/lib/supabase/server";
import type { BoothRow, Database } from "@/types/database";
import type { BoothStatus, BoothTaxCategory } from "@/types/domain";

type BoothUpdateRow = Database["public"]["Tables"]["booths"]["Update"];

export type InsertBoothInput = {
  business_id: string;
  location_id?: string | null;
  name: string;
  description?: string | null;
  capacity?: number;
  price?: number;
  tax_category?: BoothTaxCategory;
  status?: BoothStatus;
};

export type UpdateBoothInput = {
  location_id?: string | null;
  name?: string;
  description?: string | null;
  capacity?: number;
  price?: number;
  tax_category?: BoothTaxCategory;
  status?: BoothStatus;
};

export async function findBoothsByBusinessId(businessId: string): Promise<BoothRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booths")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BoothRow[];
}

export async function findBoothById(id: string, businessId: string): Promise<BoothRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booths")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as BoothRow | null;
}

export async function insertBooth(input: InsertBoothInput): Promise<BoothRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booths")
    .insert({
      business_id: input.business_id,
      location_id: input.location_id ?? null,
      name: input.name,
      description: input.description ?? null,
      capacity: input.capacity ?? 1,
      price: input.price ?? 0,
      tax_category: input.tax_category ?? "standard",
      status: input.status ?? "active",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BoothRow;
}

export async function updateBooth(id: string, input: UpdateBoothInput): Promise<BoothRow> {
  const supabase = await createClient();

  const patch: BoothUpdateRow = { updated_at: new Date().toISOString() };
  if (input.location_id !== undefined) patch.location_id = input.location_id;
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.capacity !== undefined) patch.capacity = input.capacity;
  if (input.price !== undefined) patch.price = input.price;
  if (input.tax_category !== undefined) patch.tax_category = input.tax_category;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await supabase
    .from("booths")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as BoothRow;
}

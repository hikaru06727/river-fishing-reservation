import { createClient } from "@/lib/supabase/server";
import type { TaxRate } from "@/types/database";

export async function getCurrentTaxRate(): Promise<TaxRate | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("tax_rates")
    .select("*")
    .lte("valid_from", today)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .order("valid_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as TaxRate | null;
}

export async function findAllTaxRates(): Promise<TaxRate[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tax_rates")
    .select("*")
    .order("valid_from", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TaxRate[];
}

export type InsertTaxRateInput = {
  rate_percent: number;
  valid_from: string;
  valid_until?: string | null;
};

export async function insertTaxRate(input: InsertTaxRateInput): Promise<TaxRate> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tax_rates")
    .insert({
      rate_percent: input.rate_percent,
      valid_from: input.valid_from,
      valid_until: input.valid_until ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as TaxRate;
}

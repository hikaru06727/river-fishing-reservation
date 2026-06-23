import { createClient } from "@/lib/supabase/server";
import type { Database, ProductSale } from "@/types/database";
import type { ProductSaleStatus } from "@/types/domain";

type ProductSaleUpdateRow = Database["public"]["Tables"]["product_sales"]["Update"];

export type InsertProductSaleInput = {
  business_id: string;
  product_id: string;
  quantity: number;
  unit_price_excluding_tax: number;
  tax_rate_percent: number;
  payment_method: "stripe" | "cash";
  status?: ProductSaleStatus;
  recorded_by: string;
  purchased_at?: string;
};

export type UpdateProductSaleInput = {
  quantity?: number;
  status?: ProductSaleStatus;
};

export type ProductSaleFilters = {
  fromDate?: string;
  toDate?: string;
  status?: ProductSaleStatus;
};

export async function findProductSalesByBusinessId(
  businessId: string,
  filters: ProductSaleFilters = {},
): Promise<ProductSale[]> {
  const supabase = await createClient();

  let query = supabase
    .from("product_sales")
    .select("*")
    .eq("business_id", businessId)
    .order("purchased_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.fromDate) {
    query = query.gte("purchased_at", filters.fromDate);
  }
  if (filters.toDate) {
    query = query.lte("purchased_at", filters.toDate + "T23:59:59");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductSale[];
}

export async function findProductSaleById(id: string): Promise<ProductSale | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_sales")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ProductSale | null;
}

export async function insertProductSale(input: InsertProductSaleInput): Promise<ProductSale> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_sales")
    .insert({
      business_id: input.business_id,
      product_id: input.product_id,
      quantity: input.quantity,
      unit_price_excluding_tax: input.unit_price_excluding_tax,
      tax_rate_percent: input.tax_rate_percent,
      payment_method: input.payment_method,
      status: input.status ?? "completed",
      recorded_by: input.recorded_by,
      ...(input.purchased_at ? { purchased_at: input.purchased_at } : {}),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ProductSale;
}

export async function updateProductSale(
  id: string,
  input: UpdateProductSaleInput,
): Promise<ProductSale> {
  const supabase = await createClient();

  const patch: ProductSaleUpdateRow = {};
  if (input.quantity !== undefined) patch.quantity = input.quantity;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await supabase
    .from("product_sales")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ProductSale;
}

export async function deleteProductSale(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_sales").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

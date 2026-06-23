import { createClient } from "@/lib/supabase/server";
import type { Database, Product } from "@/types/database";
import type { ProductStatus } from "@/types/domain";

type ProductUpdateRow = Database["public"]["Tables"]["products"]["Update"];

export type InsertProductInput = {
  business_id: string;
  name: string;
  description?: string | null;
  price_excluding_tax: number;
  stock_quantity?: number | null;
  image_url?: string | null;
  status?: ProductStatus;
  default_tax_rate?: number;
  category?: string | null;
};

export type UpdateProductInput = {
  name?: string;
  description?: string | null;
  price_excluding_tax?: number;
  stock_quantity?: number | null;
  image_url?: string | null;
  status?: ProductStatus;
  default_tax_rate?: number;
  category?: string | null;
};

export async function findProductsByBusinessId(businessId: string): Promise<Product[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}

export async function findAllProductsByBusinessId(businessId: string): Promise<Product[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}

export async function findProductById(id: string): Promise<Product | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Product | null;
}

export async function insertProduct(input: InsertProductInput): Promise<Product> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .insert({
      business_id: input.business_id,
      name: input.name,
      description: input.description ?? null,
      price_excluding_tax: input.price_excluding_tax,
      stock_quantity: input.stock_quantity ?? null,
      image_url: input.image_url ?? null,
      status: input.status ?? "on_sale",
      default_tax_rate: input.default_tax_rate ?? 10,
      category: input.category ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Product;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  const supabase = await createClient();

  const patch: ProductUpdateRow = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.price_excluding_tax !== undefined)
    patch.price_excluding_tax = input.price_excluding_tax;
  if (input.stock_quantity !== undefined) patch.stock_quantity = input.stock_quantity;
  if (input.image_url !== undefined) patch.image_url = input.image_url;
  if (input.status !== undefined) patch.status = input.status;
  if (input.default_tax_rate !== undefined) patch.default_tax_rate = input.default_tax_rate;
  if (input.category !== undefined) patch.category = input.category;

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** 事業の商品ごと累計販売数（product_sales 集計） */
export async function findProductSalesCountsByBusinessId(
  businessId: string,
): Promise<Record<string, number>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_sales")
    .select("product_id, quantity")
    .eq("business_id", businessId)
    .eq("status", "completed");

  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.product_id] = (counts[row.product_id] ?? 0) + row.quantity;
  }
  return counts;
}

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
  is_published_online?: boolean;
  track_inventory?: boolean;
  shippable?: boolean;
  description_online?: string | null;
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
  is_published_online?: boolean;
  track_inventory?: boolean;
  shippable?: boolean;
  description_online?: string | null;
};

/** 顧客向け公開商品の表示用カラム */
export type PublicProductRow = Pick<
  Product,
  | "id"
  | "business_id"
  | "name"
  | "price_excluding_tax"
  | "default_tax_rate"
  | "image_url"
  | "track_inventory"
  | "stock_quantity"
  | "description_online"
  | "shippable"
>;

const PUBLIC_PRODUCT_COLUMNS =
  "id, business_id, name, price_excluding_tax, default_tax_rate, image_url, track_inventory, stock_quantity, description_online, shippable";

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
      is_published_online: input.is_published_online ?? false,
      track_inventory: input.track_inventory ?? false,
      shippable: input.shippable ?? true,
      description_online: input.description_online ?? null,
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
  if (input.is_published_online !== undefined) patch.is_published_online = input.is_published_online;
  if (input.track_inventory !== undefined) patch.track_inventory = input.track_inventory;
  if (input.shippable !== undefined) patch.shippable = input.shippable;
  if (input.description_online !== undefined) patch.description_online = input.description_online;

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

/** 顧客向け公開商品一覧（is_published_online = true かつ on_sale のみ） */
export async function findPublishedProductsByBusinessId(
  businessId: string,
): Promise<PublicProductRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("business_id", businessId)
    .eq("is_published_online", true)
    .eq("status", "on_sale")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PublicProductRow[];
}

/** 顧客向け公開商品詳細（business_id 不一致・非公開・非販売中は null） */
export async function findPublishedProductById(
  businessId: string,
  id: string,
): Promise<PublicProductRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq("id", id)
    .eq("business_id", businessId)
    .eq("is_published_online", true)
    .eq("status", "on_sale")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as PublicProductRow | null;
}

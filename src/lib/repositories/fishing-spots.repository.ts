import { createClient } from "@/lib/supabase/server";
import type { FishingSpot } from "@/types/database";

export type SpotListItem = Pick<
  FishingSpot,
  "id" | "name" | "slug" | "description" | "prefecture" | "image_url"
>;

export type SpotSummaryRow = Pick<FishingSpot, "id" | "name" | "slug">;

export type SpotDetailRow = Pick<
  FishingSpot,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "prefecture"
  | "address"
  | "image_url"
  | "capacity"
>;

/** 公開中の釣り場一覧 */
export async function findActiveSpots(): Promise<SpotListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spots")
    .select("id, name, slug, description, prefecture, image_url")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

/** 公開中の釣り場サマリー（ID 指定） */
export async function findActiveSpotSummaryById(id: string): Promise<SpotSummaryRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spots")
    .select("id, name, slug")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** 公開中の釣り場詳細（slug 指定） */
export async function findActiveSpotDetailBySlug(slug: string): Promise<SpotDetailRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spots")
    .select("id, name, slug, description, prefecture, address, image_url, capacity")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** slug 指定で公開中釣り場（API 用・詳細カラム少なめ） */
export async function findActiveSpotBySlugForApi(
  slug: string,
): Promise<SpotDetailRow | null> {
  return findActiveSpotDetailBySlug(slug);
}

/** 公開中釣り場一覧（API 用） */
export async function findActiveSpotsForApi(): Promise<SpotListItem[]> {
  return findActiveSpots();
}

/** 公開中釣り場一覧（全カラム・API 用） */
export async function findActiveSpotsFull(): Promise<FishingSpot[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spots")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

/** 公開中釣り場（slug・全カラム・API 用） */
export async function findActiveSpotFullBySlug(slug: string): Promise<FishingSpot | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spots")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/** 公開中釣り場の id/name 一覧（管理フォーム用） */
export async function findActiveSpotIdAndNames(): Promise<
  Pick<FishingSpot, "id" | "name">[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spots")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

/** 管理画面: 釣り場 ID 一覧（active フィルタなし） */
export async function findAllSpotIdsAndNames(): Promise<
  Pick<FishingSpot, "id" | "name">[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fishing_spots")
    .select("id, name")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

import { createClient } from "@/lib/supabase/server";

/** business_admin の担当事業 ID 一覧（RLS 下・anon client） */
export async function findAssignedBusinessIdsByUserId(userId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_admin_assignments")
    .select("business_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.business_id);
}

/** 事業名一覧（管理画面表示用） */
export async function findBusinessNamesByIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("businesses")
    .select("name")
    .in("id", ids)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((b) => b.name);
}

/** spot の business_id を取得（権限チェック用） */
export async function findSpotBusinessIdBySpotId(
  spotId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("business_id")
    .eq("id", spotId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.business_id ?? null;
}

/** reservation の spot_id を取得（権限チェック用） */
export async function findReservationSpotIdByReservationId(
  reservationId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select("spot_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.spot_id ?? null;
}

export type ManageableSpotRow = {
  id: string;
  name: string;
  business_id: string | null;
  is_active: boolean;
};

export type ManageableBusinessRow = {
  id: string;
  name: string;
  is_active: boolean;
};

/** 管理画面フィルタ用の事業一覧（admin は全件、business_admin は割当分） */
export async function findManageableBusinesses(): Promise<ManageableBusinessRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, is_active")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ManageableBusinessRow[];
}

export type ActiveBusinessRow = {
  id: string;
  name: string;
  slug: string;
};

/** 顧客向け: slug から is_active な事業を解決（未認証アクセス可） */
export async function findActiveBusinessBySlug(slug: string): Promise<ActiveBusinessRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** 管理画面フィルタ用の釣り場一覧 */
export async function findManageableSpots(): Promise<ManageableSpotRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("id, name, business_id, is_active")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ManageableSpotRow[];
}

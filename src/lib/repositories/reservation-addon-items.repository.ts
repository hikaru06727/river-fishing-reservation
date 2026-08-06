import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ReservationAddonItemRow } from "@/types/database";

export type InsertReservationAddonItemInput = {
  reservation_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  tax_rate: number;
  quantity: number;
};

/**
 * reservations と同じ方針で service_role のみが書き込む
 * （authenticated 向けの INSERT/UPDATE ポリシーは意図的に作らない）。
 */
export async function createReservationAddonItems(
  items: InsertReservationAddonItemInput[],
): Promise<ReservationAddonItemRow[]> {
  if (items.length === 0) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reservation_addon_items")
    .insert(items)
    .select("*");

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** 顧客向け（予約詳細等）: RLS 下で自分の予約のアドオンのみ取得 */
export async function findActiveAddonItemsByReservationId(
  reservationId: string,
): Promise<ReservationAddonItemRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservation_addon_items")
    .select("*")
    .eq("reservation_id", reservationId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Webhook・現地精算・キャンセル処理用（service_role） */
export async function findActiveAddonItemsByReservationIdAdmin(
  reservationId: string,
): Promise<ReservationAddonItemRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservation_addon_items")
    .select("*")
    .eq("reservation_id", reservationId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * 未引当（stock_decremented_at IS NULL）の active 明細だけを引当済みにする。
 * 冪等: 既に引当済みの行は対象外になるため、Webhook 再送などで二重減算しない。
 * 戻り値は今回実際に引当を確定した明細（在庫 decrement 対象）。
 */
export async function markAddonItemsStockDecrementedAdmin(
  reservationId: string,
): Promise<ReservationAddonItemRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservation_addon_items")
    .update({ stock_decremented_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("reservation_id", reservationId)
    .eq("status", "active")
    .is("stock_decremented_at", null)
    .select("*");

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * 予約キャンセルに伴い、有効なアドオン明細を全て cancelled にする。
 * 戻り値は無効化前に active だった明細（在庫が引当済みなら復元対象になる）。
 */
export async function cancelAddonItemsForReservationAdmin(
  reservationId: string,
): Promise<ReservationAddonItemRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservation_addon_items")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("reservation_id", reservationId)
    .eq("status", "active")
    .select("*");

  if (error) throw new Error(error.message);
  return data ?? [];
}

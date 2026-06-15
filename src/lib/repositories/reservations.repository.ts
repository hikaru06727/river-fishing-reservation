import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Reservation, ReservationStatus } from "@/types/database";

export type ReservationInsert = {
  user_id: string;
  spot_id: string;
  plan_id: string;
  slot_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  total_amount_yen: number;
  status: ReservationStatus;
  expires_at: string;
};

export type AtomicReservationRpcResult = {
  reservation_id: string | null;
  success: boolean;
  error_code: string | null;
  error_message: string | null;
};

export type CreateReservationAtomicInput = ReservationInsert & {
  affected_slot_ids: string[];
};

export type CancelReservationAtomicInput = {
  reservation_id: string;
  user_id: string;
  affected_slot_ids: string[];
  guest_count: number;
};

function firstRpcRow(data: AtomicReservationRpcResult[] | null): AtomicReservationRpcResult | null {
  return data?.[0] ?? null;
}

/**
 * 予約作成 + スロット更新を DB トランザクション（RPC）で原子的に実行。
 * 同時実行時は FOR UPDATE 行ロック + 容量再検証でダブルブッキングを防ぐ。
 */
export async function createReservationAtomic(
  input: CreateReservationAtomicInput,
): Promise<AtomicReservationRpcResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("create_reservation_atomic", {
    p_user_id: input.user_id,
    p_spot_id: input.spot_id,
    p_plan_id: input.plan_id,
    p_slot_id: input.slot_id,
    p_reservation_date: input.reservation_date,
    p_start_time: input.start_time,
    p_end_time: input.end_time,
    p_guest_count: input.guest_count,
    p_total_amount_yen: input.total_amount_yen,
    p_expires_at: input.expires_at,
    p_affected_slot_ids: input.affected_slot_ids,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = firstRpcRow(data as AtomicReservationRpcResult[] | null);
  if (!row) {
    throw new Error("予約 RPC が結果を返しませんでした");
  }

  return row;
}

/**
 * 予約キャンセル + スロット更新を DB トランザクション（RPC）で原子的に実行。
 */
export async function cancelReservationAtomic(
  input: CancelReservationAtomicInput,
): Promise<AtomicReservationRpcResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("cancel_reservation_atomic", {
    p_reservation_id: input.reservation_id,
    p_user_id: input.user_id,
    p_affected_slot_ids: input.affected_slot_ids,
    p_guest_count: input.guest_count,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = firstRpcRow(data as AtomicReservationRpcResult[] | null);
  if (!row) {
    throw new Error("キャンセル RPC が結果を返しませんでした");
  }

  return row;
}

/** @deprecated createReservationAtomic を使用すること */
export async function insertReservation(
  input: ReservationInsert,
): Promise<Pick<Reservation, "id" | "status" | "slot_id" | "guest_count">> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .insert(input)
    .select("id, status, slot_id, guest_count")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** @deprecated createReservationAtomic 失敗時のロールバック専用。通常フローでは不要 */
export async function deleteReservationById(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("reservations").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function findReservationByIdForUser(
  id: string,
  userId: string,
): Promise<Reservation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** @deprecated cancelReservationAtomic を使用すること */
export async function updateReservationStatus(
  id: string,
  userId: string,
  status: ReservationStatus,
  allowedCurrentStatuses?: ReservationStatus[],
): Promise<Reservation | null> {
  const supabase = await createClient();

  let query = supabase
    .from("reservations")
    .update({ status })
    .eq("id", id)
    .eq("user_id", userId);

  if (allowedCurrentStatuses?.length) {
    query = query.in("status", allowedCurrentStatuses);
  }

  const { data, error } = await query.select("*").maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function findSpotSlugById(spotId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("fishing_spots")
    .select("slug")
    .eq("id", spotId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.slug ?? null;
}

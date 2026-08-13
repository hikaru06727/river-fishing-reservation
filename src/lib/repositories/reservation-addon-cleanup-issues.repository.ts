import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReservationAddonCleanupIssueRow } from "@/types/database";
import type { AddonCleanupStep } from "@/types/domain";

export type InsertAddonCleanupIssueInput = {
  reservation_id: string;
  business_id: string;
  failed_steps: AddonCleanupStep[];
  detail?: string | null;
};

/**
 * アドオン後処理(cancelAddonItemsAndRestoreStock)の失敗記録を作成する。
 * 予約キャンセル処理内(service_role コンテキスト)からのみ呼ぶ。
 */
export async function insertAddonCleanupIssue(
  input: InsertAddonCleanupIssueInput,
): Promise<ReservationAddonCleanupIssueRow> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservation_addon_cleanup_issues")
    .insert({
      reservation_id: input.reservation_id,
      business_id: input.business_id,
      failed_steps: input.failed_steps,
      detail: input.detail ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ReservationAddonCleanupIssueRow;
}

/** 事業の未対応のアドオン後処理失敗一覧(新しい順)。管理画面の「要対応」パネル用 */
export async function findUnresolvedAddonCleanupIssuesByBusinessId(
  businessId: string,
): Promise<ReservationAddonCleanupIssueRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservation_addon_cleanup_issues")
    .select("*")
    .eq("business_id", businessId)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ReservationAddonCleanupIssueRow[];
}

/**
 * アドオン後処理失敗を「対応済み」にする。
 * 対象外(他事業・既に対応済み)の場合は false を返す。
 */
export async function markAddonCleanupIssueResolved(
  id: string,
  businessId: string,
  resolvedBy: string,
  resolutionNote?: string | null,
): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservation_addon_cleanup_issues")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
      resolution_note: resolutionNote ?? null,
    })
    .eq("id", id)
    .eq("business_id", businessId)
    .is("resolved_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data !== null;
}

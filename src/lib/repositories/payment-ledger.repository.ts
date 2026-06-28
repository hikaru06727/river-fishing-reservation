import { createClient } from "@/lib/supabase/server";
import type { PaymentLedgerRow } from "@/types/database";
import type {
  PaymentLedgerPaymentMethod,
  PaymentLedgerSourceType,
  PaymentLedgerStatus,
} from "@/types/domain";

export type UpsertPaymentLedgerInput = {
  business_id: string;
  source_type: PaymentLedgerSourceType;
  source_id: string;
  amount: number;
  payment_method: PaymentLedgerPaymentMethod;
  status?: PaymentLedgerStatus;
  paid_at?: string | null;
};

/** 特定売上レコードの支払い台帳エントリを取得 */
export async function findBySource(
  sourceType: PaymentLedgerSourceType,
  sourceId: string,
): Promise<PaymentLedgerRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_ledger")
    .select("*")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as PaymentLedgerRow | null;
}

/** 事業・期間で絞り込んだ支払い台帳エントリ一覧を取得 */
export async function findByBusinessAndPeriod(
  businessId: string,
  periodStartIso: string,
  periodEndIso: string,
): Promise<PaymentLedgerRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_ledger")
    .select("*")
    .eq("business_id", businessId)
    .gte("paid_at", periodStartIso)
    .lte("paid_at", periodEndIso)
    .order("paid_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PaymentLedgerRow[];
}

/** 締め集計用: 期間内の精算済みエントリを取得（status = 'succeeded', paid_at でフィルタ） */
export async function findSucceededInPeriod(
  businessId: string,
  periodStartIso: string,
  periodEndIso: string,
): Promise<PaymentLedgerRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_ledger")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "succeeded")
    .gte("paid_at", periodStartIso)
    .lte("paid_at", periodEndIso)
    .order("paid_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PaymentLedgerRow[];
}

export type UnsettledItem = {
  source_type: PaymentLedgerSourceType;
  source_id: string;
};

/**
 * 締め前の未精算アイテムを返す。
 *
 * source_type 別のブロックルール:
 *   pos / manual  : status が pending / refunded / partially_refunded → 常にブロック
 *   reservation   : status='pending' かつ reservation_date <= periodEnd のみブロック
 *                   （利用日未到来の予約は締めに無関係のため除外）
 */
export async function findUnsettledInPeriod(
  businessId: string,
  _periodStartIso: string,
  periodEndIso: string,
): Promise<UnsettledItem[]> {
  const supabase = await createClient();

  // 1. POS・手動売上の未精算エントリ（source_type='reservation' は別クエリで処理）
  const { data: ledgerData, error: ledgerError } = await supabase
    .from("payment_ledger")
    .select("source_type, source_id")
    .eq("business_id", businessId)
    .in("source_type", ["pos", "manual"])
    .in("status", ["pending", "refunded", "partially_refunded"])
    .order("created_at", { ascending: true });

  if (ledgerError) throw new Error(ledgerError.message);

  // 2. 利用日が periodEnd 以前の未払い予約のみ（将来日の予約はブロック対象外）
  const periodEndDate = periodEndIso.slice(0, 10); // YYYY-MM-DD (UTC)

  const { data: spotData, error: spotError } = await supabase
    .from("locations")
    .select("id")
    .eq("business_id", businessId);

  if (spotError) throw new Error(spotError.message);

  const spotIds = (spotData ?? []).map((s) => s.id);
  let pendingReservations: { id: string }[] = [];

  if (spotIds.length > 0) {
    const { data: resData, error: resError } = await supabase
      .from("reservations")
      .select("id")
      .in("spot_id", spotIds)
      .eq("status", "pending")
      .lte("reservation_date", periodEndDate);

    if (resError) throw new Error(resError.message);
    pendingReservations = resData ?? [];
  }

  return [
    ...(ledgerData ?? []).map((e) => ({
      source_type: e.source_type as PaymentLedgerSourceType,
      source_id: e.source_id,
    })),
    ...pendingReservations.map((r) => ({
      source_type: "reservation" as const,
      source_id: r.id,
    })),
  ];
}

/**
 * 支払い台帳エントリを作成または更新する（source_type + source_id の UNIQUE 制約を利用）。
 * 同一売上の二重登録は上書き更新される。
 */
export async function upsertPaymentLedger(
  input: UpsertPaymentLedgerInput,
): Promise<PaymentLedgerRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_ledger")
    .upsert(
      {
        business_id: input.business_id,
        source_type: input.source_type,
        source_id: input.source_id,
        amount: input.amount,
        payment_method: input.payment_method,
        status: input.status ?? "pending",
        paid_at: input.paid_at ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_type,source_id" },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PaymentLedgerRow;
}

/** 支払いステータスを更新する */
export async function updatePaymentLedgerStatus(
  id: string,
  status: PaymentLedgerStatus,
  paidAt?: string | null,
): Promise<void> {
  const supabase = await createClient();

  const patch: { status: PaymentLedgerStatus; paid_at?: string | null; updated_at: string } = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (paidAt !== undefined) patch.paid_at = paidAt;

  const { error } = await supabase
    .from("payment_ledger")
    .update(patch)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

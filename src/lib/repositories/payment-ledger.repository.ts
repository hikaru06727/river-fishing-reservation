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

/**
 * periodStart 以降に作成された未精算エントリを取得する。
 *
 * 上限を periodEnd（ページロード時刻）にしない理由:
 *   periodEnd は Server Component のレンダリング時刻で固定される。
 *   ページロード後に挿入された pending レコードは created_at > periodEnd となり
 *   上限フィルタで除外されてしまう。
 *   締め前チェックの目的は「現在時点で未精算のものを全て検出すること」なので
 *   上限は実行時の now() とし、periodEnd に縛られない。
 */
export async function findUnsettledInPeriod(
  businessId: string,
  periodStartIso: string,
  _periodEndIso: string,
): Promise<PaymentLedgerRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_ledger")
    .select("*")
    .eq("business_id", businessId)
    .gte("created_at", periodStartIso)
    .in("status", ["pending", "refunded", "partially_refunded"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PaymentLedgerRow[];
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

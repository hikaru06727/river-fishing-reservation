import {
  findBySource,
  findByBusinessAndPeriod,
  findSucceededInPeriod,
  findUnsettledInPeriod,
  upsertPaymentLedger,
  updatePaymentLedgerStatus,
  type UpsertPaymentLedgerInput,
  type UnsettledItem,
} from "@/lib/repositories/payment-ledger.repository";
import type { PaymentLedgerRow } from "@/types/database";
import type {
  PaymentLedgerPaymentMethod,
  PaymentLedgerSourceType,
  PaymentLedgerStatus,
} from "@/types/domain";

export type UnsettledSummary = {
  total: number;
  bySourceType: {
    pos: number;
    reservation: number;
    manual: number;
  };
  entries: UnsettledItem[];
};

/** 特定売上レコードの台帳エントリを取得 */
export async function getPaymentLedgerBySource(
  sourceType: PaymentLedgerSourceType,
  sourceId: string,
): Promise<PaymentLedgerRow | null> {
  return findBySource(sourceType, sourceId);
}

/** 事業・期間の台帳エントリ一覧を取得 */
export async function getPaymentLedgerByPeriod(
  businessId: string,
  periodStartIso: string,
  periodEndIso: string,
): Promise<PaymentLedgerRow[]> {
  return findByBusinessAndPeriod(businessId, periodStartIso, periodEndIso);
}

/**
 * 締め前の未精算チェック。
 * 期間内に status が 'pending' / 'refunded' / 'partially_refunded' のエントリが
 * 存在する場合は件数と種別内訳を返す。
 */
export async function checkUnsettledBeforeClose(
  businessId: string,
  periodStartIso: string,
  periodEndIso: string,
): Promise<UnsettledSummary> {
  const entries = await findUnsettledInPeriod(businessId, periodStartIso, periodEndIso);

  const bySourceType = { pos: 0, reservation: 0, manual: 0 };
  for (const entry of entries) {
    bySourceType[entry.source_type]++;
  }

  return {
    total: entries.length,
    bySourceType,
    entries,
  };
}

/** 台帳エントリを作成または更新する */
export async function recordPaymentLedger(
  input: UpsertPaymentLedgerInput,
): Promise<PaymentLedgerRow> {
  return upsertPaymentLedger(input);
}

/** 台帳エントリのステータスを更新する */
export async function updatePaymentStatus(
  id: string,
  status: PaymentLedgerStatus,
  paidAt?: string | null,
): Promise<void> {
  return updatePaymentLedgerStatus(id, status, paidAt);
}

const CASH_PAYMENT_METHODS = new Set(["cash", "cash_at_venue"]);
const CARD_PAYMENT_METHODS = new Set(["card", "stripe", "credit_card", "online"]);

/** 任意の支払方法文字列を payment_ledger の bucketed 値（cash/card/other）に変換する */
export function toLedgerPaymentMethod(method: string | null): PaymentLedgerPaymentMethod {
  if (!method) return "other";
  if (CASH_PAYMENT_METHODS.has(method)) return "cash";
  if (CARD_PAYMENT_METHODS.has(method)) return "card";
  return "other";
}

/** 締め集計用: 期間内の精算済みエントリを { amountYen, paymentMethod } 形式で返す */
export async function getLedgerRowsForClosing(
  businessId: string,
  periodStartIso: string,
  periodEndIso: string,
): Promise<Array<{ amountYen: number; paymentMethod: PaymentLedgerPaymentMethod }>> {
  const entries = await findSucceededInPeriod(businessId, periodStartIso, periodEndIso);
  return entries.map((e) => ({ amountYen: e.amount, paymentMethod: e.payment_method }));
}

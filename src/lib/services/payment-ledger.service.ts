import {
  findBySource,
  findByBusinessAndPeriod,
  findUnsettledInPeriod,
  upsertPaymentLedger,
  updatePaymentLedgerStatus,
  type UpsertPaymentLedgerInput,
} from "@/lib/repositories/payment-ledger.repository";
import type { PaymentLedgerRow } from "@/types/database";
import type { PaymentLedgerSourceType, PaymentLedgerStatus } from "@/types/domain";

export type UnsettledSummary = {
  total: number;
  bySourceType: {
    pos: number;
    reservation: number;
    manual: number;
  };
  entries: PaymentLedgerRow[];
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

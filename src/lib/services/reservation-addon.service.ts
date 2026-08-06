import { findProductsByIds } from "@/lib/repositories/products.repository";
import { decrementProductStockAdmin, incrementProductStockAdmin } from "@/lib/repositories/products.repository";
import {
  cancelAddonItemsForReservationAdmin,
  createReservationAddonItems,
  findActiveAddonItemsByReservationIdAdmin,
  markAddonItemsStockDecrementedAdmin,
} from "@/lib/repositories/reservation-addon-items.repository";
import {
  findBySourceAdmin,
  recordPaymentLedgerAdmin,
  updatePaymentLedgerStatusAdmin,
} from "@/lib/repositories/payment-ledger.repository";
import type { ReservationAddonItemRow } from "@/types/database";
import type { PaymentLedgerPaymentMethod } from "@/types/domain";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export type AddonSelectionInput = {
  productId: string;
  quantity: number;
};

export type AddonAmountSummary = {
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
};

function summarize(items: Array<{ unit_price: number; tax_rate: number; quantity: number }>): AddonAmountSummary {
  let subtotalAmount = 0;
  let taxAmount = 0;
  for (const item of items) {
    const net = item.unit_price * item.quantity;
    const tax = Math.floor((net * item.tax_rate) / 100);
    subtotalAmount += net;
    taxAmount += tax;
  }
  return { subtotalAmount, taxAmount, totalAmount: subtotalAmount + taxAmount };
}

type ValidatedAddonLine = {
  product_id: string;
  product_name: string;
  unit_price: number;
  tax_rate: number;
  quantity: number;
};

/**
 * 予約フローのアドオン選択を検証する（公開中・販売中・在庫チェック）。
 * online-order.service.ts の createOrder と同じ検証ロジック（配送可否チェックは対象外）。
 */
async function validateAddonSelections(
  businessId: string,
  items: AddonSelectionInput[],
): Promise<ServiceResult<ValidatedAddonLine[]>> {
  if (items.length === 0) {
    return { ok: true, data: [] };
  }

  const productIds = items.map((i) => i.productId);
  const products = await findProductsByIds(productIds, businessId);
  const productById = new Map(products.map((p) => [p.id, p]));

  const lines: ValidatedAddonLine[] = [];
  for (const item of items) {
    if (item.quantity <= 0) {
      return { ok: false, error: "数量は1以上で指定してください。", status: 400 };
    }
    const product = productById.get(item.productId);
    if (!product) {
      return { ok: false, error: "購入できない商品が含まれています。", status: 400 };
    }
    if (
      product.track_inventory &&
      product.stock_quantity !== null &&
      product.stock_quantity < item.quantity
    ) {
      return {
        ok: false,
        error: `「${product.name}」の在庫が不足しています。現在の在庫数: ${product.stock_quantity}`,
        status: 400,
      };
    }
    lines.push({
      product_id: product.id,
      product_name: product.name,
      unit_price: product.price_excluding_tax,
      tax_rate: product.default_tax_rate,
      quantity: item.quantity,
    });
  }

  return { ok: true, data: lines };
}

/** 予約作成フロー内で呼ぶ。検証のみ行い在庫は減算しない（Webhook / 現地精算時に減算） */
export async function createAddonItemsForReservation(
  reservationId: string,
  businessId: string,
  items: AddonSelectionInput[],
): Promise<ServiceResult<{ items: ReservationAddonItemRow[]; summary: AddonAmountSummary }>> {
  const validation = await validateAddonSelections(businessId, items);
  if (!validation.ok) return validation;

  if (validation.data.length === 0) {
    return { ok: true, data: { items: [], summary: { subtotalAmount: 0, taxAmount: 0, totalAmount: 0 } } };
  }

  try {
    const created = await createReservationAddonItems(
      validation.data.map((line) => ({
        reservation_id: reservationId,
        product_id: line.product_id,
        product_name: line.product_name,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
        quantity: line.quantity,
      })),
    );
    return { ok: true, data: { items: created, summary: summarize(created) } };
  } catch (e) {
    console.error("[createAddonItemsForReservation] insert failed:", e);
    return { ok: false, error: "アドオン商品の登録に失敗しました。", status: 500 };
  }
}

/** 有効なアドオン明細の合計額（税抜/税/税込）。Stripe line_items 構築・返金上限計算で使う */
export async function getActiveAddonAmountSummary(reservationId: string): Promise<AddonAmountSummary> {
  const items = await findActiveAddonItemsByReservationIdAdmin(reservationId);
  return summarize(items);
}

export async function getActiveAddonItems(reservationId: string): Promise<ReservationAddonItemRow[]> {
  return findActiveAddonItemsByReservationIdAdmin(reservationId);
}

/**
 * オンライン決済Webhook確認・現地精算確定の両方から呼ぶ。
 * 未引当のアドオン明細だけ在庫を decrement し（冪等）、reservation_addon の
 * payment_ledger 行を記録する（予約分とは別レコード・同一 reservation_id）。
 */
export async function confirmAddonPaymentAndStock(params: {
  reservationId: string;
  businessId: string;
  paymentMethod: PaymentLedgerPaymentMethod;
  paidAtIso: string;
}): Promise<void> {
  const newlyDecremented = await markAddonItemsStockDecrementedAdmin(params.reservationId);

  for (const item of newlyDecremented) {
    try {
      await decrementProductStockAdmin(item.product_id, item.quantity);
    } catch (e) {
      console.error("[confirmAddonPaymentAndStock] stock decrement failed:", e);
    }
  }

  const activeItems = await findActiveAddonItemsByReservationIdAdmin(params.reservationId);
  if (activeItems.length === 0) return;

  const summary = summarize(activeItems);
  try {
    await recordPaymentLedgerAdmin({
      business_id: params.businessId,
      source_type: "reservation_addon",
      source_id: params.reservationId,
      amount: summary.totalAmount,
      payment_method: params.paymentMethod,
      status: "succeeded",
      paid_at: params.paidAtIso,
    });
  } catch (e) {
    console.error("[confirmAddonPaymentAndStock] payment_ledger upsert failed:", e);
  }
}

/**
 * 予約キャンセルに伴うアドオンの一体キャンセル。
 * - active な明細を全て cancelled にする
 * - 在庫が引当済み（stock_decremented_at 有）だった明細のみ在庫を復元する
 * - reservation_addon の payment_ledger 行が存在すれば refunded に更新する
 *   （Stripe 返金 API 呼び出し自体は呼び出し元の cancelReservation が行う）
 */
export async function cancelAddonItemsAndRestoreStock(reservationId: string): Promise<void> {
  const cancelledItems = await cancelAddonItemsForReservationAdmin(reservationId);

  for (const item of cancelledItems) {
    if (!item.stock_decremented_at) continue;
    try {
      await incrementProductStockAdmin(item.product_id, item.quantity);
    } catch (e) {
      console.error("[cancelAddonItemsAndRestoreStock] stock restore failed:", e);
    }
  }

  const ledgerRow = await findBySourceAdmin("reservation_addon", reservationId);
  if (ledgerRow && ledgerRow.status === "succeeded") {
    try {
      await updatePaymentLedgerStatusAdmin(ledgerRow.id, "refunded");
    } catch (e) {
      console.error("[cancelAddonItemsAndRestoreStock] payment_ledger status update failed:", e);
    }
  }
}

import { revalidatePath } from "next/cache";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { findAssignedBusinessIdsByStaffUserId } from "@/lib/repositories/staff-members.repository";
import {
  insertSaleRefund,
  insertSaleRefundAdmin,
  updateSaleRefundStatus,
  findRefundsByBusinessId,
  findUnresolvedFailedRefundsByBusinessId,
  markSaleRefundResolved,
  findStripePaymentIntentByReservationId,
  findStripePaymentIntentByReservationIdAdmin,
  findStripePaymentIntentByOnlineOrderId,
  findSaleSessionAmountById,
  findReservationAmountById,
  findReservationAmountByIdAdmin,
  findOnlineOrderAmountById,
  findTotalRefundedAmount,
  findTotalRefundedAmountAdmin,
  findSaleSessionSoldAtById,
  findReservationDateById,
  findReservationDateByIdAdmin,
} from "@/lib/repositories/sale-refunds.repository";
import { updateOnlineOrderPaymentStatus } from "@/lib/repositories/online-order.repository";
import {
  findClosingContainingSoldAt,
  findClosingContainingReservationDate,
  findClosingContainingReservationDateAdmin,
  updatePostCloseRefund,
} from "@/lib/repositories/register-closings.repository";
import { findBySourceAdmin, updatePaymentLedgerStatusAdmin } from "@/lib/repositories/payment-ledger.repository";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { hasPermission } from "@/lib/permissions";
import { isAdminRole, isBusinessAdminRole, isStaffRole } from "@/lib/auth/role";
import { getStripe } from "@/lib/stripe/server";
import type { Profile, SaleRefundRow } from "@/types/database";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

type OperatorProfile = Pick<Profile, "id" | "role">;

export type RefundWithDetails = SaleRefundRow;

async function recordPostCloseRefundIfNeeded(params: {
  businessId: string;
  saleSessionId?: string | null;
  reservationId?: string | null;
  paymentMethod: "cash" | "card" | "other";
  amount: number;
}): Promise<void> {
  let matchedClosing = null;

  if (params.saleSessionId) {
    const soldAt = await findSaleSessionSoldAtById(params.saleSessionId).catch(() => null);
    if (!soldAt) return;
    matchedClosing = await findClosingContainingSoldAt(params.businessId, soldAt).catch(() => null);
  } else if (params.reservationId) {
    const date = await findReservationDateById(params.reservationId).catch(() => null);
    if (!date) return;
    matchedClosing = await findClosingContainingReservationDate(params.businessId, date).catch(
      () => null,
    );
  }

  if (!matchedClosing) return;

  // 返金日時が締め日時より前の場合は締め前返金 → 差分記録しない
  const now = new Date().toISOString();
  if (now < matchedClosing.closed_at) return;

  await updatePostCloseRefund({
    closingId: matchedClosing.id,
    paymentMethod: params.paymentMethod,
    amount: params.amount,
  });
}

async function resolveAssignedIds(profile: OperatorProfile): Promise<string[]> {
  if (isAdminRole(profile.role)) return [];
  if (isStaffRole(profile.role)) {
    return findAssignedBusinessIdsByStaffUserId(profile.id);
  }
  return findAssignedBusinessIdsByUserId(profile.id);
}

async function assertCanAccessBusiness(
  profile: OperatorProfile,
  businessId: string,
): Promise<ServiceResult<null>> {
  const assignedIds = await resolveAssignedIds(profile);
  if (!canManageBusinessForProfile(profile, businessId, assignedIds)) {
    return { ok: false, error: "この事業への操作権限がありません。", status: 403 };
  }
  return { ok: true, data: null };
}

async function validateRefundAmount(params: {
  saleSessionId?: string | null;
  reservationId?: string | null;
  onlineOrderId?: string | null;
  amount: number;
}): Promise<ServiceResult<{ alreadyRefunded: number; originalAmount: number }>> {
  const { saleSessionId, reservationId, onlineOrderId, amount } = params;

  let originalAmount: number | null = null;
  if (saleSessionId) {
    originalAmount = await findSaleSessionAmountById(saleSessionId).catch(() => null);
  } else if (reservationId) {
    originalAmount = await findReservationAmountById(reservationId).catch(() => null);
  } else if (onlineOrderId) {
    originalAmount = await findOnlineOrderAmountById(onlineOrderId).catch(() => null);
  }

  if (originalAmount === null) {
    return { ok: false, error: "対象の売上が見つかりません。", status: 404 };
  }

  const alreadyRefunded = await findTotalRefundedAmount({
    saleSessionId: saleSessionId ?? undefined,
    reservationId: reservationId ?? undefined,
    onlineOrderId: onlineOrderId ?? undefined,
  }).catch(() => 0);

  if (amount + alreadyRefunded > originalAmount) {
    return {
      ok: false,
      error: `返金額が元の決済額を超えています。（残返金可能額: ¥${(originalAmount - alreadyRefunded).toLocaleString()}）`,
      status: 422,
    };
  }

  return { ok: true, data: { alreadyRefunded, originalAmount } };
}

/** 追加購入注文（online_orders）が全額返金されたかを判定し、該当すれば payment_status を反映する（Phase 19E） */
async function markOnlineOrderRefundedIfFullyRefunded(params: {
  onlineOrderId: string;
  amount: number;
  alreadyRefunded: number;
  originalAmount: number;
}): Promise<void> {
  if (params.amount + params.alreadyRefunded < params.originalAmount) return;
  await updateOnlineOrderPaymentStatus(params.onlineOrderId, "refunded").catch((e) => {
    console.error("[markOnlineOrderRefundedIfFullyRefunded]", e);
  });
}

export type RefundCashParams = {
  businessId: string;
  saleSessionId?: string;
  reservationId?: string;
  onlineOrderId?: string;
  amount: number;
  reason: string;
  refundedBy: string;
  note?: string;
};

/** 現金返金（即時完了） */
export async function refundCash(
  profile: OperatorProfile,
  params: RefundCashParams,
): Promise<ServiceResult<SaleRefundRow>> {
  if (!hasPermission(profile.role, "REFUND_MANAGE")) {
    return { ok: false, error: "返金操作権限がありません。", status: 403 };
  }

  const auth = await assertCanAccessBusiness(profile, params.businessId);
  if (!auth.ok) return auth;

  const validation = await validateRefundAmount({
    saleSessionId: params.saleSessionId,
    reservationId: params.reservationId,
    onlineOrderId: params.onlineOrderId,
    amount: params.amount,
  });
  if (!validation.ok) return validation;

  try {
    const refund = await insertSaleRefund({
      business_id: params.businessId,
      sale_session_id: params.saleSessionId ?? null,
      reservation_id: params.reservationId ?? null,
      online_order_id: params.onlineOrderId ?? null,
      amount: params.amount,
      payment_method: "cash",
      reason: params.reason,
      refunded_by: params.refundedBy,
      status: "completed",
      note: params.note ?? null,
    });

    await recordPostCloseRefundIfNeeded({
      businessId: params.businessId,
      saleSessionId: params.saleSessionId,
      reservationId: params.reservationId,
      paymentMethod: "cash",
      amount: params.amount,
    }).catch(() => undefined);

    if (params.onlineOrderId) {
      await markOnlineOrderRefundedIfFullyRefunded({
        onlineOrderId: params.onlineOrderId,
        amount: params.amount,
        alreadyRefunded: validation.data.alreadyRefunded,
        originalAmount: validation.data.originalAmount,
      });
    }

    revalidatePath("/admin/refunds");
    return { ok: true, data: refund };
  } catch {
    return { ok: false, error: "返金記録の保存に失敗しました。", status: 500 };
  }
}

export type RefundCardParams = {
  businessId: string;
  saleSessionId?: string;
  reservationId?: string;
  onlineOrderId?: string;
  stripePaymentIntentId?: string;
  amount: number;
  reason: string;
  refundedBy: string;
  note?: string;
};

/** カード返金（Stripe API 経由） */
export async function refundCard(
  profile: OperatorProfile,
  params: RefundCardParams,
): Promise<ServiceResult<SaleRefundRow>> {
  if (!hasPermission(profile.role, "REFUND_MANAGE")) {
    return { ok: false, error: "返金操作権限がありません。", status: 403 };
  }

  const auth = await assertCanAccessBusiness(profile, params.businessId);
  if (!auth.ok) return auth;

  const validation = await validateRefundAmount({
    saleSessionId: params.saleSessionId,
    reservationId: params.reservationId,
    onlineOrderId: params.onlineOrderId,
    amount: params.amount,
  });
  if (!validation.ok) return validation;

  // reservationId / onlineOrderId がある場合は Stripe payment_intent_id を自動取得
  let paymentIntentId = params.stripePaymentIntentId;
  if (!paymentIntentId && params.reservationId) {
    paymentIntentId =
      (await findStripePaymentIntentByReservationId(params.reservationId).catch(() => null)) ??
      undefined;
  }
  if (!paymentIntentId && params.onlineOrderId) {
    paymentIntentId =
      (await findStripePaymentIntentByOnlineOrderId(params.onlineOrderId).catch(() => null)) ??
      undefined;
  }

  let stripeRefundId: string | null = null;
  let refundStatus: "completed" | "failed" = "completed";
  let failureNote: string | null = null;

  if (paymentIntentId) {
    try {
      const stripe = getStripe();
      // JPY は最小通貨単位が円（×100不要）
      const stripeRefund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(params.amount),
        reason: "requested_by_customer",
      });
      stripeRefundId = stripeRefund.id;
      refundStatus = "completed";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe返金エラー";
      refundStatus = "failed";
      failureNote = message;
    }
  } else {
    // Stripe ID がない場合は記録のみ（手動カード返金）
    refundStatus = "completed";
  }

  try {
    const refund = await insertSaleRefund({
      business_id: params.businessId,
      sale_session_id: params.saleSessionId ?? null,
      reservation_id: params.reservationId ?? null,
      online_order_id: params.onlineOrderId ?? null,
      stripe_refund_id: stripeRefundId,
      stripe_payment_intent_id: paymentIntentId ?? null,
      amount: params.amount,
      payment_method: "card",
      reason: params.reason,
      refunded_by: params.refundedBy,
      status: refundStatus,
      note: failureNote ?? params.note ?? null,
    });

    if (refundStatus !== "failed") {
      await recordPostCloseRefundIfNeeded({
        businessId: params.businessId,
        saleSessionId: params.saleSessionId,
        reservationId: params.reservationId,
        paymentMethod: "card",
        amount: params.amount,
      }).catch(() => undefined);

      if (params.onlineOrderId) {
        await markOnlineOrderRefundedIfFullyRefunded({
          onlineOrderId: params.onlineOrderId,
          amount: params.amount,
          alreadyRefunded: validation.data.alreadyRefunded,
          originalAmount: validation.data.originalAmount,
        });
      }
    }

    revalidatePath("/admin/refunds");

    if (refundStatus === "failed") {
      return { ok: false, error: `Stripe返金に失敗しました: ${failureNote ?? "不明"}`, status: 500 };
    }

    return { ok: true, data: refund };
  } catch {
    return { ok: false, error: "返金記録の保存に失敗しました。", status: 500 };
  }
}

/**
 * 表示用: online_order の返金済み合計額を取得する（Phase 19E）。
 * payment_status は全額返金時のみ 'refunded' に遷移するため、部分返金は
 * この合計額を都度計算することでのみ検知できる（sale_refunds が唯一の情報源）。
 */
export async function getRefundedAmountForOnlineOrder(onlineOrderId: string): Promise<number> {
  return findTotalRefundedAmount({ onlineOrderId }).catch(() => 0);
}

/** 返金一覧取得 */
export async function listRefunds(
  profile: OperatorProfile,
  params: {
    businessId: string;
    page?: number;
    limit?: number;
  },
): Promise<ServiceResult<{ data: RefundWithDetails[]; count: number }>> {
  if (!hasPermission(profile.role, "REFUND_MANAGE")) {
    return { ok: false, error: "返金履歴閲覧権限がありません。", status: 403 };
  }

  const auth = await assertCanAccessBusiness(profile, params.businessId);
  if (!auth.ok) return auth;

  const limit = params.limit ?? 30;
  const offset = ((params.page ?? 1) - 1) * limit;

  try {
    const result = await findRefundsByBusinessId(params.businessId, limit, offset);
    return { ok: true, data: result };
  } catch {
    return { ok: false, error: "返金一覧の取得に失敗しました。", status: 500 };
  }
}

/**
 * 未対応の失敗返金一覧（管理画面「返金失敗・要対応」パネル用）。
 * cancelReservation() の自動返金が Stripe 側で失敗した場合、キャンセル自体は
 * 進める方針のため、この一覧が返金の唯一の検知・追跡手段になる。
 */
export async function listUnresolvedFailedRefunds(
  profile: OperatorProfile,
  params: { businessId: string },
): Promise<ServiceResult<RefundWithDetails[]>> {
  if (!hasPermission(profile.role, "REFUND_MANAGE")) {
    return { ok: false, error: "返金履歴閲覧権限がありません。", status: 403 };
  }

  const auth = await assertCanAccessBusiness(profile, params.businessId);
  if (!auth.ok) return auth;

  try {
    const data = await findUnresolvedFailedRefundsByBusinessId(params.businessId);
    return { ok: true, data };
  } catch {
    return { ok: false, error: "返金一覧の取得に失敗しました。", status: 500 };
  }
}

/**
 * 失敗した返金を「対応済み」にする。Stripe側で再返金するわけではなく、
 * 管理者が現金対応・顧客連絡など何らかの形で手動対応したことを記録するのみ。
 * staff には許可しない（sale_refunds への UPDATE 権限がRLS上そもそも無い）。
 */
export async function resolveFailedRefund(
  profile: OperatorProfile,
  params: { businessId: string; refundId: string; note?: string | null },
): Promise<ServiceResult<null>> {
  if (!isAdminRole(profile.role) && !isBusinessAdminRole(profile.role)) {
    return { ok: false, error: "この操作を行う権限がありません。", status: 403 };
  }

  const auth = await assertCanAccessBusiness(profile, params.businessId);
  if (!auth.ok) return auth;

  try {
    const updated = await markSaleRefundResolved(
      params.refundId,
      params.businessId,
      profile.id,
      params.note ?? null,
    );
    if (!updated) {
      return {
        ok: false,
        error: "対象の返金が見つからないか、既に対応済みです。",
        status: 404,
      };
    }
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "対応済みへの更新に失敗しました。", status: 500 };
  }
}

async function recordPostCloseRefundIfNeededAdmin(params: {
  businessId: string;
  reservationId: string;
  paymentMethod: "cash" | "card" | "other";
  amount: number;
}): Promise<void> {
  const date = await findReservationDateByIdAdmin(params.reservationId).catch(() => null);
  if (!date) return;

  const matchedClosing = await findClosingContainingReservationDateAdmin(
    params.businessId,
    date,
  ).catch(() => null);
  if (!matchedClosing) return;

  // 返金日時が締め日時より前の場合は締め前返金 → 差分記録しない
  const now = new Date().toISOString();
  if (now < matchedClosing.closed_at) return;

  await updatePostCloseRefund({
    closingId: matchedClosing.id,
    paymentMethod: params.paymentMethod,
    amount: params.amount,
  });
}

export type AutoRefundReservationParams = {
  reservationId: string;
  businessId: string;
  /** 呼び出し元の実行者 id。管理者キャンセルは管理者自身の id、顧客自身のキャンセルは system profile の id を渡す */
  refundedBy: string;
  reason: string;
};

export type AutoRefundReservationResult = {
  /** true の場合のみ Stripe 返金 API を実際に呼んだ（オンライン決済・未返金残額ありの場合のみ） */
  refunded: boolean;
  amount: number;
  failed: boolean;
  failureNote: string | null;
};

/**
 * 予約キャンセル（顧客自身・管理者どちらも）に伴う自動全額返金。
 * cancelReservation() から service_role コンテキストで呼ぶため、RLS に依存する
 * refundCard() ではなく *Admin 系リポジトリ関数のみを使う。
 *
 * 現地決済（cash_at_venue）は Stripe payment_intent が存在しないため対象外
 * （現金は API 経由で自動返金できないため、既に精算済みの場合は管理者による
 *  手動返金が必要 — /admin/refunds から従来どおり refundCash を使う）。
 */
export async function autoRefundReservationOnCancel(
  params: AutoRefundReservationParams,
): Promise<AutoRefundReservationResult> {
  const paymentIntentId = await findStripePaymentIntentByReservationIdAdmin(
    params.reservationId,
  ).catch(() => null);

  if (!paymentIntentId) {
    return { refunded: false, amount: 0, failed: false, failureNote: null };
  }

  const originalAmount = await findReservationAmountByIdAdmin(params.reservationId).catch(
    () => null,
  );
  if (originalAmount === null) {
    return { refunded: false, amount: 0, failed: false, failureNote: null };
  }

  const alreadyRefunded = await findTotalRefundedAmountAdmin(params.reservationId).catch(() => 0);
  const amount = originalAmount - alreadyRefunded;
  if (amount <= 0) {
    return { refunded: false, amount: 0, failed: false, failureNote: null };
  }

  let stripeRefundId: string | null = null;
  let status: "completed" | "failed" = "completed";
  let failureNote: string | null = null;

  try {
    const stripe = getStripe();
    const stripeRefund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amount),
      reason: "requested_by_customer",
    });
    stripeRefundId = stripeRefund.id;
  } catch (err) {
    status = "failed";
    failureNote = err instanceof Error ? err.message : "Stripe返金エラー";
  }

  try {
    await insertSaleRefundAdmin({
      business_id: params.businessId,
      reservation_id: params.reservationId,
      stripe_refund_id: stripeRefundId,
      stripe_payment_intent_id: paymentIntentId,
      amount,
      payment_method: "card",
      reason: params.reason,
      refunded_by: params.refundedBy,
      status,
      note: failureNote,
    });
  } catch (e) {
    console.error("[autoRefundReservationOnCancel] sale_refunds insert failed:", e);
  }

  if (status === "failed") {
    return { refunded: false, amount, failed: true, failureNote };
  }

  await recordPostCloseRefundIfNeededAdmin({
    businessId: params.businessId,
    reservationId: params.reservationId,
    paymentMethod: "card",
    amount,
  }).catch(() => undefined);

  const ledgerRow = await findBySourceAdmin("reservation", params.reservationId).catch(() => null);
  if (ledgerRow && ledgerRow.status === "succeeded") {
    await updatePaymentLedgerStatusAdmin(ledgerRow.id, "refunded").catch((e) => {
      console.error("[autoRefundReservationOnCancel] payment_ledger status update failed:", e);
    });
  }

  return { refunded: true, amount, failed: false, failureNote: null };
}

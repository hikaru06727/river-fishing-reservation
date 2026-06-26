import { revalidatePath } from "next/cache";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { findAssignedBusinessIdsByStaffUserId } from "@/lib/repositories/staff-members.repository";
import {
  insertSaleRefund,
  updateSaleRefundStatus,
  findRefundsByBusinessId,
  findStripePaymentIntentByReservationId,
  findSaleSessionAmountById,
  findReservationAmountById,
  findTotalRefundedAmount,
} from "@/lib/repositories/sale-refunds.repository";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { hasPermission } from "@/lib/permissions";
import { isAdminRole, isStaffRole } from "@/lib/auth/role";
import { getStripe } from "@/lib/stripe/server";
import type { Profile, SaleRefundRow } from "@/types/database";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

type OperatorProfile = Pick<Profile, "id" | "role">;

export type RefundWithDetails = SaleRefundRow;

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
  amount: number;
}): Promise<ServiceResult<null>> {
  const { saleSessionId, reservationId, amount } = params;

  let originalAmount: number | null = null;
  if (saleSessionId) {
    originalAmount = await findSaleSessionAmountById(saleSessionId).catch(() => null);
  } else if (reservationId) {
    originalAmount = await findReservationAmountById(reservationId).catch(() => null);
  }

  if (originalAmount === null) {
    return { ok: false, error: "対象の売上が見つかりません。", status: 404 };
  }

  const alreadyRefunded = await findTotalRefundedAmount({
    saleSessionId: saleSessionId ?? undefined,
    reservationId: reservationId ?? undefined,
  }).catch(() => 0);

  if (amount + alreadyRefunded > originalAmount) {
    return {
      ok: false,
      error: `返金額が元の決済額を超えています。（残返金可能額: ¥${(originalAmount - alreadyRefunded).toLocaleString()}）`,
      status: 422,
    };
  }

  return { ok: true, data: null };
}

export type RefundCashParams = {
  businessId: string;
  saleSessionId?: string;
  reservationId?: string;
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
    amount: params.amount,
  });
  if (!validation.ok) return validation;

  try {
    const refund = await insertSaleRefund({
      business_id: params.businessId,
      sale_session_id: params.saleSessionId ?? null,
      reservation_id: params.reservationId ?? null,
      amount: params.amount,
      payment_method: "cash",
      reason: params.reason,
      refunded_by: params.refundedBy,
      status: "completed",
      note: params.note ?? null,
    });
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
    amount: params.amount,
  });
  if (!validation.ok) return validation;

  // reservationId がある場合は Stripe payment_intent_id を自動取得
  let paymentIntentId = params.stripePaymentIntentId;
  if (!paymentIntentId && params.reservationId) {
    paymentIntentId =
      (await findStripePaymentIntentByReservationId(params.reservationId).catch(() => null)) ??
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
      stripe_refund_id: stripeRefundId,
      stripe_payment_intent_id: paymentIntentId ?? null,
      amount: params.amount,
      payment_method: "card",
      reason: params.reason,
      refunded_by: params.refundedBy,
      status: refundStatus,
      note: failureNote ?? params.note ?? null,
    });
    revalidatePath("/admin/refunds");

    if (refundStatus === "failed") {
      return { ok: false, error: `Stripe返金に失敗しました: ${failureNote ?? "不明"}`, status: 500 };
    }

    return { ok: true, data: refund };
  } catch {
    return { ok: false, error: "返金記録の保存に失敗しました。", status: 500 };
  }
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

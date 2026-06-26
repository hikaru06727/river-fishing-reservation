import { revalidatePath } from "next/cache";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { findAssignedBusinessIdsByStaffUserId } from "@/lib/repositories/staff-members.repository";
import {
  findClosingsByBusinessId,
  findClosingById,
  findLastClosingByBusinessId,
  insertRegisterClosing,
  updateClosingStatus,
  insertCorrectionRequest,
  findCorrectionsByClosingId,
  findPendingCorrectionsByBusinessId,
  updateCorrectionStatus,
  findCorrectionById,
  findSalesRowsForClosing,
  type ClosingSalesRawRow,
} from "@/lib/repositories/register-closings.repository";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { hasPermission } from "@/lib/permissions";
import { isAdminRole, isStaffRole } from "@/lib/auth/role";
import type { Profile, RegisterClosingCorrectionRow, RegisterClosingRow } from "@/types/database";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

type OperatorProfile = Pick<Profile, "id" | "role">;

const CASH_METHODS = new Set(["cash", "cash_at_venue"]);
const CARD_METHODS = new Set(["card", "stripe", "credit_card", "online"]);

function bucketPaymentMethod(method: string | null): "cash" | "card" | "other" {
  if (!method) return "other";
  if (CASH_METHODS.has(method)) return "cash";
  if (CARD_METHODS.has(method)) return "card";
  return "other";
}

function aggregateSales(rows: ClosingSalesRawRow[]): {
  totalCash: number;
  totalCard: number;
  totalOther: number;
  totalAmount: number;
} {
  let totalCash = 0;
  let totalCard = 0;
  let totalOther = 0;

  for (const row of rows) {
    const bucket = bucketPaymentMethod(row.paymentMethod);
    if (bucket === "cash") totalCash += row.amountYen;
    else if (bucket === "card") totalCard += row.amountYen;
    else totalOther += row.amountYen;
  }

  return { totalCash, totalCard, totalOther, totalAmount: totalCash + totalCard + totalOther };
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

export type CloseRegisterParams = {
  businessId: string;
  locationId?: string | null;
  periodStart: Date;
  periodEnd: Date;
  note?: string | null;
  closedBy: string;
};

/** 指定期間の売上を集計してレジを締める */
export async function closeRegister(
  profile: OperatorProfile,
  params: CloseRegisterParams,
): Promise<ServiceResult<RegisterClosingRow>> {
  if (!hasPermission(profile.role, "POS_CLOSE")) {
    return { ok: false, error: "レジ締め権限がありません。", status: 403 };
  }

  const auth = await assertCanAccessBusiness(profile, params.businessId);
  if (!auth.ok) return auth;

  let rows: ClosingSalesRawRow[];
  try {
    rows = await findSalesRowsForClosing({
      businessId: params.businessId,
      periodStartIso: params.periodStart.toISOString(),
      periodEndIso: params.periodEnd.toISOString(),
    });
  } catch {
    return { ok: false, error: "売上データの集計に失敗しました。", status: 500 };
  }

  const { totalCash, totalCard, totalOther, totalAmount } = aggregateSales(rows);

  try {
    const closing = await insertRegisterClosing({
      business_id: params.businessId,
      location_id: params.locationId ?? null,
      closed_by: params.closedBy,
      period_start: params.periodStart.toISOString(),
      period_end: params.periodEnd.toISOString(),
      total_cash: totalCash,
      total_card: totalCard,
      total_other: totalOther,
      total_amount: totalAmount,
      note: params.note ?? null,
    });
    revalidatePath("/admin/register-closing");
    return { ok: true, data: closing };
  } catch {
    return { ok: false, error: "レジ締め記録の保存に失敗しました。", status: 500 };
  }
}

export type RegisterClosingWithDetails = RegisterClosingRow & {
  corrections: RegisterClosingCorrectionRow[];
};

/** 締め記録一覧取得（ページネーション付き） */
export async function listClosings(
  profile: OperatorProfile,
  params: {
    businessId: string;
    locationId?: string;
    page?: number;
    limit?: number;
  },
): Promise<ServiceResult<{ data: RegisterClosingWithDetails[]; count: number }>> {
  if (!hasPermission(profile.role, "POS_CLOSE")) {
    return { ok: false, error: "締め記録閲覧権限がありません。", status: 403 };
  }

  const auth = await assertCanAccessBusiness(profile, params.businessId);
  if (!auth.ok) return auth;

  const limit = params.limit ?? 20;
  const offset = ((params.page ?? 1) - 1) * limit;

  try {
    const { data: closings, count } = await findClosingsByBusinessId(
      params.businessId,
      limit,
      offset,
    );

    const withDetails: RegisterClosingWithDetails[] = await Promise.all(
      closings.map(async (closing) => {
        const corrections = await findCorrectionsByClosingId(closing.id).catch(() => []);
        return { ...closing, corrections };
      }),
    );

    return { ok: true, data: { data: withDetails, count } };
  } catch {
    return { ok: false, error: "締め記録の取得に失敗しました。", status: 500 };
  }
}

/** 前回の締め記録を取得（次の締め期間の開始時刻に使用） */
export async function getLastClosing(
  profile: OperatorProfile,
  businessId: string,
): Promise<ServiceResult<RegisterClosingRow | null>> {
  const auth = await assertCanAccessBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const closing = await findLastClosingByBusinessId(businessId);
    return { ok: true, data: closing };
  } catch {
    return { ok: false, error: "前回の締め記録取得に失敗しました。", status: 500 };
  }
}

/** 修正リクエスト送信（staff / business_admin 両方可） */
export async function requestCorrection(
  profile: OperatorProfile,
  params: {
    closingId: string;
    requestedBy: string;
    reason: string;
    businessId: string;
  },
): Promise<ServiceResult<void>> {
  if (!hasPermission(profile.role, "CLOSE_CORRECTION_REQUEST")) {
    return { ok: false, error: "修正リクエスト権限がありません。", status: 403 };
  }

  const auth = await assertCanAccessBusiness(profile, params.businessId);
  if (!auth.ok) return auth;

  let closing: RegisterClosingRow | null;
  try {
    closing = await findClosingById(params.closingId);
  } catch {
    return { ok: false, error: "締め記録の取得に失敗しました。", status: 500 };
  }

  if (!closing) {
    return { ok: false, error: "締め記録が見つかりません。", status: 404 };
  }
  if (closing.business_id !== params.businessId) {
    return { ok: false, error: "この締め記録への操作権限がありません。", status: 403 };
  }

  try {
    await insertCorrectionRequest({
      closing_id: params.closingId,
      requested_by: params.requestedBy,
      reason: params.reason,
    });
    await updateClosingStatus(params.closingId, "correction_requested");
    revalidatePath("/admin/register-closing");
  } catch {
    return { ok: false, error: "修正リクエストの送信に失敗しました。", status: 500 };
  }

  return { ok: true, data: undefined };
}

/** 修正リクエスト承認（business_admin のみ） */
export async function approveCorrection(
  profile: OperatorProfile,
  params: {
    correctionId: string;
    approvedBy: string;
    businessId: string;
  },
): Promise<ServiceResult<void>> {
  if (!hasPermission(profile.role, "CLOSE_CORRECTION_APPROVE")) {
    return { ok: false, error: "修正リクエスト承認権限がありません。", status: 403 };
  }

  const auth = await assertCanAccessBusiness(profile, params.businessId);
  if (!auth.ok) return auth;

  let correction: RegisterClosingCorrectionRow | null;
  try {
    correction = await findCorrectionById(params.correctionId);
  } catch {
    return { ok: false, error: "修正リクエストの取得に失敗しました。", status: 500 };
  }

  if (!correction) {
    return { ok: false, error: "修正リクエストが見つかりません。", status: 404 };
  }
  if (correction.status !== "pending") {
    return { ok: false, error: "このリクエストはすでに処理済みです。", status: 409 };
  }

  let closing: RegisterClosingRow | null;
  try {
    closing = await findClosingById(correction.closing_id);
  } catch {
    return { ok: false, error: "締め記録の取得に失敗しました。", status: 500 };
  }

  if (!closing || closing.business_id !== params.businessId) {
    return { ok: false, error: "この修正リクエストへの操作権限がありません。", status: 403 };
  }

  try {
    await updateCorrectionStatus(params.correctionId, "approved", params.approvedBy);
    await updateClosingStatus(correction.closing_id, "approved");
    revalidatePath("/admin/register-closing");
  } catch {
    return { ok: false, error: "修正リクエストの承認に失敗しました。", status: 500 };
  }

  return { ok: true, data: undefined };
}

/** pending 修正リクエスト件数を取得 */
export async function getPendingCorrectionCount(
  profile: OperatorProfile,
  businessId: string,
): Promise<number> {
  if (!hasPermission(profile.role, "CLOSE_CORRECTION_APPROVE")) return 0;

  try {
    const corrections = await findPendingCorrectionsByBusinessId(businessId);
    return corrections.length;
  } catch {
    return 0;
  }
}

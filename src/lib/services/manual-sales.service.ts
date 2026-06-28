import { revalidatePath } from "next/cache";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import {
  deleteManualSale,
  findManualSaleById,
  findManualSalesByBusinessId,
  insertManualSale,
  updateManualSale,
  type InsertManualSaleInput,
  type ManualSaleFilters,
  type UpdateManualSaleInput,
} from "@/lib/repositories/manual-sales.repository";
import {
  getPaymentLedgerBySource,
  recordPaymentLedger,
  toLedgerPaymentMethod,
  updatePaymentStatus,
} from "@/lib/services/payment-ledger.service";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { isAdminRole, isBusinessAdminRole } from "@/lib/auth/role";
import type { ManualSale, Profile } from "@/types/database";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

type SaleProfile = Pick<Profile, "id" | "role">;

async function resolveAssignedIds(profile: SaleProfile): Promise<readonly string[]> {
  if (isAdminRole(profile.role)) return [];
  return findAssignedBusinessIdsByUserId(profile.id);
}

async function assertCanManageBusiness(
  profile: SaleProfile,
  businessId: string,
): Promise<ServiceResult<null>> {
  const assignedIds = await resolveAssignedIds(profile);
  if (!canManageBusinessForProfile(profile, businessId, assignedIds)) {
    return { ok: false, error: "この事業への操作権限がありません。", status: 403 };
  }
  return { ok: true, data: null };
}

export async function getManualSalesForBusiness(
  profile: SaleProfile,
  businessId: string,
  filters: ManualSaleFilters = {},
): Promise<ServiceResult<ManualSale[]>> {
  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const sales = await findManualSalesByBusinessId(businessId, filters);
    return { ok: true, data: sales };
  } catch {
    return { ok: false, error: "手動売上の取得に失敗しました。", status: 500 };
  }
}

export type CreateManualSaleInput = {
  business_id: string;
  location_id?: string | null;
  sale_date: string;
  amount_yen: number;
  tax_rate_percent: number;
  category: InsertManualSaleInput["category"];
  payment_method: InsertManualSaleInput["payment_method"];
  description?: string | null;
};

export async function createManualSale(
  profile: SaleProfile,
  input: CreateManualSaleInput,
): Promise<ServiceResult<ManualSale>> {
  if (!isAdminRole(profile.role) && !isBusinessAdminRole(profile.role)) {
    return { ok: false, error: "手動売上を登録する権限がありません。", status: 403 };
  }

  const auth = await assertCanManageBusiness(profile, input.business_id);
  if (!auth.ok) return auth;

  let sale: ManualSale;
  try {
    sale = await insertManualSale({ ...input, recorded_by: profile.id });
  } catch {
    return { ok: false, error: "手動売上の登録に失敗しました。", status: 500 };
  }

  try {
    await recordPaymentLedger({
      business_id: sale.business_id,
      source_type: "manual",
      source_id: sale.id,
      amount: sale.amount_yen,
      payment_method: toLedgerPaymentMethod(sale.payment_method),
      status: "succeeded",
      paid_at: `${sale.sale_date}T00:00:00+09:00`,
    });
  } catch (e) {
    console.error("[createManualSale] payment_ledger write failed, rolling back:", e);
    try {
      await deleteManualSale(sale.id);
    } catch (cleanupErr) {
      console.error("[createManualSale] rollback failed (orphan may remain):", cleanupErr);
    }
    return { ok: false, error: "台帳への記録に失敗しました。", status: 500 };
  }

  revalidatePath("/admin/sales");
  revalidatePath("/admin/manual-sales");
  return { ok: true, data: sale };
}

export async function updateManualSaleById(
  profile: SaleProfile,
  id: string,
  input: UpdateManualSaleInput,
): Promise<ServiceResult<ManualSale>> {
  let existing: ManualSale | null;
  try {
    existing = await findManualSaleById(id);
  } catch {
    return { ok: false, error: "手動売上の取得に失敗しました。", status: 500 };
  }

  if (!existing) {
    return { ok: false, error: "手動売上が見つかりません。", status: 404 };
  }

  const auth = await assertCanManageBusiness(profile, existing.business_id);
  if (!auth.ok) return auth;

  let updated: ManualSale;
  try {
    updated = await updateManualSale(id, input);
  } catch {
    return { ok: false, error: "手動売上の更新に失敗しました。", status: 500 };
  }

  // 金額・支払方法が変わった場合は payment_ledger も更新
  if (input.amount_yen !== undefined || input.payment_method !== undefined || input.sale_date !== undefined) {
    try {
      await recordPaymentLedger({
        business_id: updated.business_id,
        source_type: "manual",
        source_id: updated.id,
        amount: updated.amount_yen,
        payment_method: toLedgerPaymentMethod(updated.payment_method),
        status: "succeeded",
        paid_at: `${updated.sale_date}T00:00:00+09:00`,
      });
    } catch (e) {
      console.error("[updateManualSaleById] payment_ledger update failed:", e);
      return { ok: false, error: "台帳の更新に失敗しました。", status: 500 };
    }
  }

  revalidatePath("/admin/sales");
  revalidatePath("/admin/manual-sales");
  return { ok: true, data: updated };
}

export async function deleteManualSaleById(
  profile: SaleProfile,
  id: string,
): Promise<ServiceResult<null>> {
  let existing: ManualSale | null;
  try {
    existing = await findManualSaleById(id);
  } catch {
    return { ok: false, error: "手動売上の取得に失敗しました。", status: 500 };
  }

  if (!existing) {
    return { ok: false, error: "手動売上が見つかりません。", status: 404 };
  }

  const auth = await assertCanManageBusiness(profile, existing.business_id);
  if (!auth.ok) return auth;

  try {
    await deleteManualSale(id);
  } catch {
    return { ok: false, error: "手動売上の削除に失敗しました。", status: 500 };
  }

  // payment_ledger のステータスをキャンセルに変更
  try {
    const ledgerEntry = await getPaymentLedgerBySource("manual", id);
    if (ledgerEntry) {
      await updatePaymentStatus(ledgerEntry.id, "cancelled");
    }
  } catch (e) {
    console.error("[deleteManualSaleById] payment_ledger cancel failed:", e);
  }

  revalidatePath("/admin/sales");
  revalidatePath("/admin/manual-sales");
  return { ok: true, data: null };
}

import { revalidatePath } from "next/cache";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { findAssignedBusinessIdsByStaffUserId } from "@/lib/repositories/staff-members.repository";
import { findProductById, updateProduct } from "@/lib/repositories/products.repository";
import { deleteProductSalesBySessionId, insertProductSale } from "@/lib/repositories/product-sales.repository";
import {
  deleteSaleSessionById,
  insertSaleSession,
  insertSaleSessionDiscounts,
  insertSaleSessionItems,
} from "@/lib/repositories/sale-sessions.repository";
import { getCurrentTaxRate } from "@/lib/repositories/tax-rates.repository";
import { recordPaymentLedger, toLedgerPaymentMethod } from "@/lib/services/payment-ledger.service";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { isAdminRole, isBusinessAdminRole, isStaffRole } from "@/lib/auth/role";
import type { PosPaymentMethod, Product, Profile, SaleSession } from "@/types/database";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

type SaleProfile = Pick<Profile, "id" | "role">;

async function assertCanManageBusiness(
  profile: SaleProfile,
  businessId: string,
): Promise<ServiceResult<null>> {
  let assignedIds: readonly string[] = [];
  if (!isAdminRole(profile.role)) {
    assignedIds = isStaffRole(profile.role)
      ? await findAssignedBusinessIdsByStaffUserId(profile.id)
      : await findAssignedBusinessIdsByUserId(profile.id);
  }
  if (!canManageBusinessForProfile(profile, businessId, assignedIds)) {
    return { ok: false, error: "この事業への操作権限がありません。", status: 403 };
  }
  return { ok: true, data: null };
}

export type CartItemDiscount = {
  type: "amount" | "rate";
  value: number;
};

export type CartItem = {
  product_id: string;
  quantity: number;
  tax_rate?: number;
  item_discount?: CartItemDiscount | null;
};

export type SessionDiscount = {
  type: "amount" | "rate";
  value: number;
} | null;

export type CreateSaleSessionInput = {
  business_id: string;
  payment_method: PosPaymentMethod;
  payment_other_label?: string | null;
  items: CartItem[];
  session_discount?: SessionDiscount;
  note?: string | null;
};

function calcItemDiscountAmount(gross: number, d: CartItemDiscount | null | undefined): number {
  if (!d || d.value <= 0) return 0;
  if (d.type === "amount") return Math.min(Math.round(d.value), gross);
  return Math.floor((gross * d.value) / 100);
}

function calcSessionDiscountAmount(base: number, d: SessionDiscount): number {
  if (!d || d.value <= 0) return 0;
  if (d.type === "amount") return Math.min(Math.round(d.value), base);
  return Math.floor((base * d.value) / 100);
}

export async function createSaleSession(
  profile: SaleProfile,
  input: CreateSaleSessionInput,
): Promise<ServiceResult<SaleSession>> {
  if (!isAdminRole(profile.role) && !isBusinessAdminRole(profile.role) && !isStaffRole(profile.role)) {
    return { ok: false, error: "販売を登録する権限がありません。", status: 403 };
  }

  const auth = await assertCanManageBusiness(profile, input.business_id);
  if (!auth.ok) return auth;

  if (input.items.length === 0) {
    return { ok: false, error: "商品を選択してください。", status: 400 };
  }

  // 商品検証と在庫確認
  type ResolvedItem = {
    item: CartItem;
    product: Product;
    gross: number;
    itemDiscountAmount: number;
    net: number;
    itemTaxRate: number;
  };

  const resolvedItems: ResolvedItem[] = [];
  for (const item of input.items) {
    let product: Product | null;
    try {
      product = await findProductById(item.product_id);
    } catch {
      return { ok: false, error: "商品の取得に失敗しました。", status: 500 };
    }

    if (!product) {
      return { ok: false, error: "商品が見つかりません。", status: 404 };
    }
    if (product.status !== "on_sale") {
      return {
        ok: false,
        error: `「${product.name}」は販売中ではありません。`,
        status: 400,
      };
    }
    if (product.stock_quantity !== null && product.stock_quantity < item.quantity) {
      return {
        ok: false,
        error: `「${product.name}」の在庫が不足しています。現在の在庫数: ${product.stock_quantity}`,
        status: 400,
      };
    }

    const gross = item.quantity * product.price_excluding_tax;
    const itemDiscountAmount = calcItemDiscountAmount(gross, item.item_discount ?? null);
    const net = gross - itemDiscountAmount;
    const itemTaxRate = item.tax_rate ?? product.default_tax_rate ?? 10;

    resolvedItems.push({ item, product, gross, itemDiscountAmount, net, itemTaxRate });
  }

  // 税率取得（セッション全体のデフォルト税率）
  let taxRatePercent: number;
  try {
    const taxRate = await getCurrentTaxRate();
    taxRatePercent = taxRate?.rate_percent ?? 10;
  } catch {
    taxRatePercent = 10;
  }

  // 合計金額計算
  const subtotalAmount = resolvedItems.reduce((s, r) => s + r.gross, 0);
  const totalItemDiscounts = resolvedItems.reduce((s, r) => s + r.itemDiscountAmount, 0);
  const afterItemDiscounts = subtotalAmount - totalItemDiscounts;
  const sessionDiscountAmount = calcSessionDiscountAmount(afterItemDiscounts, input.session_discount ?? null);
  const totalDiscountAmount = totalItemDiscounts + sessionDiscountAmount;
  const finalNet = afterItemDiscounts - sessionDiscountAmount;

  // 税額計算（商品別税率 × セッション割引按分）
  let taxAmount = 0;
  if (afterItemDiscounts > 0) {
    for (const r of resolvedItems) {
      const proportion = r.net / afterItemDiscounts;
      const itemSessionDiscount = Math.floor(sessionDiscountAmount * proportion);
      const itemFinalNet = Math.max(0, r.net - itemSessionDiscount);
      taxAmount += Math.floor((itemFinalNet * r.itemTaxRate) / 100);
    }
  }
  const totalAmount = finalNet + taxAmount;

  // sale_session 作成
  let session: SaleSession;
  try {
    session = await insertSaleSession({
      business_id: input.business_id,
      payment_method: input.payment_method,
      payment_other_label: input.payment_other_label ?? null,
      tax_rate_percent: taxRatePercent,
      subtotal_amount: subtotalAmount,
      discount_amount: totalDiscountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      note: input.note ?? null,
      created_by: profile.id,
    });
  } catch (e) {
    console.error("[createSaleSession] insertSaleSession failed:", e);
    return { ok: false, error: "販売セッションの作成に失敗しました。", status: 500 };
  }

  // sale_session_items + 割引記録 + product_sales + 在庫デクリメント
  try {
    const insertedItems = await insertSaleSessionItems(
      resolvedItems.map((r) => ({
        sale_session_id: session.id,
        product_id: r.item.product_id,
        quantity: r.item.quantity,
        unit_price: r.product.price_excluding_tax,
        subtotal: r.gross,
        tax_rate_percent: r.itemTaxRate,
      })),
    );

    // アイテム割引を sale_session_discounts に記録
    const discountInserts = [];
    for (let i = 0; i < resolvedItems.length; i++) {
      const r = resolvedItems[i];
      if (r.itemDiscountAmount > 0 && r.item.item_discount) {
        const insertedItem = insertedItems[i];
        if (insertedItem) {
          discountInserts.push({
            sale_session_id: session.id,
            discount_type: r.item.item_discount.type,
            target: "item" as const,
            target_item_id: insertedItem.id,
            discount_value: r.item.item_discount.value,
            discount_amount: r.itemDiscountAmount,
          });
        }
      }
    }
    // セッション割引を記録
    if (sessionDiscountAmount > 0 && input.session_discount) {
      discountInserts.push({
        sale_session_id: session.id,
        discount_type: input.session_discount.type,
        target: "session" as const,
        target_item_id: null,
        discount_value: input.session_discount.value,
        discount_amount: sessionDiscountAmount,
      });
    }
    if (discountInserts.length > 0) {
      await insertSaleSessionDiscounts(discountInserts);
    }

    for (const r of resolvedItems) {
      await insertProductSale({
        business_id: input.business_id,
        product_id: r.item.product_id,
        quantity: r.item.quantity,
        unit_price_excluding_tax: r.product.price_excluding_tax,
        tax_rate_percent: taxRatePercent,
        payment_method: input.payment_method,
        status: "completed",
        recorded_by: profile.id,
        sale_session_id: session.id,
      });

      if (r.product.stock_quantity !== null) {
        await updateProduct(r.product.id, {
          stock_quantity: r.product.stock_quantity - r.item.quantity,
        });
      }
    }
  } catch (e) {
    console.error("[createSaleSession] items/product_sales/stock failed:", e);
    return { ok: false, error: "販売明細の作成に失敗しました。", status: 500 };
  }

  // payment_ledger に精算済みエントリを記録（締め集計の単一ソース）
  try {
    await recordPaymentLedger({
      business_id: input.business_id,
      source_type: "pos",
      source_id: session.id,
      amount: totalAmount,
      payment_method: toLedgerPaymentMethod(input.payment_method),
      status: "succeeded",
      paid_at: session.sold_at,
    });
  } catch (e) {
    console.error("[createSaleSession] payment_ledger write failed, rolling back:", e);
    try {
      await deleteProductSalesBySessionId(session.id);
      for (const r of resolvedItems) {
        if (r.product.stock_quantity !== null) {
          await updateProduct(r.product.id, { stock_quantity: r.product.stock_quantity });
        }
      }
      await deleteSaleSessionById(session.id);
    } catch (cleanupErr) {
      console.error("[createSaleSession] rollback failed (orphan may remain):", cleanupErr);
    }
    return { ok: false, error: "台帳への記録に失敗しました。", status: 500 };
  }

  revalidatePath("/admin/pos");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/sales");
  revalidatePath("/admin/sales");

  return { ok: true, data: session };
}

export async function getSaleSessionsForBusiness(
  profile: SaleProfile,
  businessId: string,
  filters: import("@/lib/repositories/sale-sessions.repository").SaleSessionListFilters = {},
): Promise<ServiceResult<import("@/lib/sales/sale-session-types").SaleSessionListRow[]>> {
  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const { listByBusiness } = await import("@/lib/repositories/sale-sessions.repository");
    const sessions = await listByBusiness(businessId, {
      ...filters,
      onlyUnsettled: filters.onlyUnsettled ?? true,
    });
    return { ok: true, data: sessions };
  } catch {
    return { ok: false, error: "販売履歴の取得に失敗しました。", status: 500 };
  }
}

export async function getSaleSessionDetail(
  profile: SaleProfile,
  sessionId: string,
): Promise<ServiceResult<import("@/lib/sales/sale-session-types").SaleSessionDetail>> {
  try {
    const { getById } = await import("@/lib/repositories/sale-sessions.repository");
    const detail = await getById(sessionId);
    if (!detail) {
      return { ok: false, error: "販売記録が見つかりません。", status: 404 };
    }

    const auth = await assertCanManageBusiness(profile, detail.business_id);
    if (!auth.ok) return auth;

    return { ok: true, data: detail };
  } catch {
    return { ok: false, error: "販売詳細の取得に失敗しました。", status: 500 };
  }
}

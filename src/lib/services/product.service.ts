import { revalidatePath } from "next/cache";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import {
  deleteProduct,
  findAllProductsByBusinessId,
  findProductById,
  insertProduct,
  updateProduct,
  type InsertProductInput,
  type UpdateProductInput,
} from "@/lib/repositories/products.repository";
import {
  deleteProductSale,
  findProductSaleById,
  findProductSalesByBusinessId,
  insertProductSale,
  type ProductSaleFilters,
} from "@/lib/repositories/product-sales.repository";
import { getCurrentTaxRate } from "@/lib/repositories/tax-rates.repository";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { isAdminRole, isBusinessAdminRole } from "@/lib/auth/role";
import type { Product, ProductSale, Profile } from "@/types/database";

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

// ----------------------------------------------------------------
// Product CRUD
// ----------------------------------------------------------------

export async function getProductsForBusiness(
  profile: SaleProfile,
  businessId: string,
): Promise<ServiceResult<Product[]>> {
  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const products = await findAllProductsByBusinessId(businessId);
    return { ok: true, data: products };
  } catch {
    return { ok: false, error: "商品の取得に失敗しました。", status: 500 };
  }
}

export type CreateProductInput = Omit<InsertProductInput, "business_id"> & {
  business_id: string;
};

export async function createProduct(
  profile: SaleProfile,
  input: CreateProductInput,
): Promise<ServiceResult<Product>> {
  if (!isAdminRole(profile.role) && !isBusinessAdminRole(profile.role)) {
    return { ok: false, error: "商品を登録する権限がありません。", status: 403 };
  }

  const auth = await assertCanManageBusiness(profile, input.business_id);
  if (!auth.ok) return auth;

  try {
    const product = await insertProduct(input);
    revalidatePath("/admin/products");
    return { ok: true, data: product };
  } catch {
    return { ok: false, error: "商品の登録に失敗しました。", status: 500 };
  }
}

export async function updateProductById(
  profile: SaleProfile,
  id: string,
  input: UpdateProductInput,
): Promise<ServiceResult<Product>> {
  let existing: Product | null;
  try {
    existing = await findProductById(id);
  } catch {
    return { ok: false, error: "商品の取得に失敗しました。", status: 500 };
  }

  if (!existing) return { ok: false, error: "商品が見つかりません。", status: 404 };

  const auth = await assertCanManageBusiness(profile, existing.business_id);
  if (!auth.ok) return auth;

  try {
    const updated = await updateProduct(id, input);
    revalidatePath("/admin/products");
    return { ok: true, data: updated };
  } catch {
    return { ok: false, error: "商品の更新に失敗しました。", status: 500 };
  }
}

export async function deleteProductById(
  profile: SaleProfile,
  id: string,
): Promise<ServiceResult<null>> {
  let existing: Product | null;
  try {
    existing = await findProductById(id);
  } catch {
    return { ok: false, error: "商品の取得に失敗しました。", status: 500 };
  }

  if (!existing) return { ok: false, error: "商品が見つかりません。", status: 404 };

  const auth = await assertCanManageBusiness(profile, existing.business_id);
  if (!auth.ok) return auth;

  try {
    await deleteProduct(id);
    revalidatePath("/admin/products");
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "商品の削除に失敗しました。", status: 500 };
  }
}

// ----------------------------------------------------------------
// ProductSale CRUD
// ----------------------------------------------------------------

export async function getProductSalesForBusiness(
  profile: SaleProfile,
  businessId: string,
  filters: ProductSaleFilters = {},
): Promise<ServiceResult<ProductSale[]>> {
  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const sales = await findProductSalesByBusinessId(businessId, filters);
    return { ok: true, data: sales };
  } catch {
    return { ok: false, error: "販売記録の取得に失敗しました。", status: 500 };
  }
}

export type CreateProductSaleInput = {
  business_id: string;
  product_id: string;
  quantity: number;
  payment_method: "stripe" | "cash";
  purchased_at?: string | null;
};

export async function createProductSale(
  profile: SaleProfile,
  input: CreateProductSaleInput,
): Promise<ServiceResult<ProductSale>> {
  if (!isAdminRole(profile.role) && !isBusinessAdminRole(profile.role)) {
    return { ok: false, error: "商品販売を登録する権限がありません。", status: 403 };
  }

  const auth = await assertCanManageBusiness(profile, input.business_id);
  if (!auth.ok) return auth;

  let product: Product | null;
  try {
    product = await findProductById(input.product_id);
  } catch {
    return { ok: false, error: "商品の取得に失敗しました。", status: 500 };
  }

  if (!product) return { ok: false, error: "商品が見つかりません。", status: 404 };
  if (product.status !== "on_sale") {
    return { ok: false, error: "販売中でない商品は購入できません。", status: 400 };
  }
  if (product.stock_quantity !== null && product.stock_quantity < input.quantity) {
    return {
      ok: false,
      error: `在庫が不足しています。現在の在庫数: ${product.stock_quantity}`,
      status: 400,
    };
  }

  let taxRatePercent: number;
  try {
    const taxRate = await getCurrentTaxRate();
    taxRatePercent = taxRate?.rate_percent ?? 10;
  } catch {
    taxRatePercent = 10;
  }

  try {
    const sale = await insertProductSale({
      business_id: input.business_id,
      product_id: input.product_id,
      quantity: input.quantity,
      unit_price_excluding_tax: product.price_excluding_tax,
      tax_rate_percent: taxRatePercent,
      payment_method: input.payment_method,
      status: "completed",
      recorded_by: profile.id,
      ...(input.purchased_at ? { purchased_at: input.purchased_at } : {}),
    });

    if (product.stock_quantity !== null) {
      await updateProduct(product.id, {
        stock_quantity: product.stock_quantity - input.quantity,
      });
    }

    revalidatePath("/admin/products/sales");
    return { ok: true, data: sale };
  } catch {
    return { ok: false, error: "販売記録の登録に失敗しました。", status: 500 };
  }
}

export async function deleteProductSaleById(
  profile: SaleProfile,
  id: string,
): Promise<ServiceResult<null>> {
  let existing: ProductSale | null;
  try {
    existing = await findProductSaleById(id);
  } catch {
    return { ok: false, error: "販売記録の取得に失敗しました。", status: 500 };
  }

  if (!existing) return { ok: false, error: "販売記録が見つかりません。", status: 404 };

  const auth = await assertCanManageBusiness(profile, existing.business_id);
  if (!auth.ok) return auth;

  try {
    await deleteProductSale(id);
    revalidatePath("/admin/products/sales");
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "販売記録の削除に失敗しました。", status: 500 };
  }
}

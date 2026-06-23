"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import {
  createProduct,
  createProductSale,
  deleteProductById,
  deleteProductSaleById,
  updateProductById,
} from "@/lib/services/product.service";
import { parseProductForm, parseProductSaleForm } from "@/validations/product";
import type { ProductActionState } from "./action-state";

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products/new");

  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  }

  const { businessId, name, description, priceExcludingTax, stockQuantity, imageUrl, status } =
    parsed.data;

  const result = await createProduct(session.profile, {
    business_id: businessId,
    name,
    description: description ?? null,
    price_excluding_tax: priceExcludingTax,
    stock_quantity: stockQuantity ?? null,
    image_url: imageUrl ?? null,
    status,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin/products?businessId=" + businessId);
}

export async function updateProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "IDが不正です。" };
  }

  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  }

  const { businessId, name, description, priceExcludingTax, stockQuantity, imageUrl, status } =
    parsed.data;

  const result = await updateProductById(session.profile, id, {
    name,
    description: description ?? null,
    price_excluding_tax: priceExcludingTax,
    stock_quantity: stockQuantity ?? null,
    image_url: imageUrl ?? null,
    status,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin/products?businessId=" + businessId);
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products");

  const id = formData.get("id");
  const businessId = formData.get("businessId");

  if (typeof id !== "string" || !id) return;

  const result = await deleteProductById(session.profile, id);
  if (!result.ok) throw new Error(result.error);

  redirect(
    "/admin/products" +
      (typeof businessId === "string" && businessId ? "?businessId=" + businessId : ""),
  );
}

export async function createProductSaleAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products/sales");

  const parsed = parseProductSaleForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };
  }

  const { businessId, productId, quantity, paymentMethod } = parsed.data;

  const result = await createProductSale(session.profile, {
    business_id: businessId,
    product_id: productId,
    quantity,
    payment_method: paymentMethod,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin/products/sales?businessId=" + businessId);
}

export async function deleteProductSaleAction(formData: FormData): Promise<void> {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products/sales");

  const id = formData.get("id");
  const businessId = formData.get("businessId");

  if (typeof id !== "string" || !id) return;

  const result = await deleteProductSaleById(session.profile, id);
  if (!result.ok) throw new Error(result.error);

  redirect(
    "/admin/products/sales" +
      (typeof businessId === "string" && businessId ? "?businessId=" + businessId : ""),
  );
}

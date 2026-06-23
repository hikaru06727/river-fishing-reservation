import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductSellForm } from "@/components/admin/ProductSellForm";
import { createProductSaleAction } from "../../actions";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findProductById } from "@/lib/repositories/products.repository";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { isAdminRole } from "@/lib/auth/role";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "商品 販売登録" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductSellPage({ params }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products");

  const { id } = await params;

  const product = await findProductById(id);
  if (!product) notFound();

  const assignedIds = isAdminRole(session.profile.role)
    ? []
    : await findAssignedBusinessIdsByUserId(session.profile.id);

  if (!canManageBusinessForProfile(session.profile, product.business_id, assignedIds)) {
    redirect("/admin/products");
  }

  const returnPath = `/admin/products?businessId=${product.business_id}`;

  return (
    <div>
      <Link href={returnPath} className="text-sm text-primary hover:underline">
        ← 商品管理
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-foreground">販売登録</h2>
      <p className="mt-1 text-sm text-muted">商品の販売数量と支払い方法を入力してください。</p>

      <div className="mx-auto mt-8 max-w-lg">
        <ProductSellForm
          action={createProductSaleAction}
          product={product}
          businessId={product.business_id}
        />
      </div>
    </div>
  );
}

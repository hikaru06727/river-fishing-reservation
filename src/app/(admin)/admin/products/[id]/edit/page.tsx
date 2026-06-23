import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { deleteProductAction, updateProductAction } from "../../actions";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { findProductById } from "@/lib/repositories/products.repository";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { isAdminRole } from "@/lib/auth/role";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "商品 編集" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductsEditPage({ params }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products");

  const { id } = await params;

  const [product, businesses] = await Promise.all([
    findProductById(id),
    findManageableBusinesses(),
  ]);

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
      <h2 className="mt-4 text-lg font-semibold text-foreground">商品 編集</h2>

      <div className="mt-8">
        <ProductForm
          action={updateProductAction}
          businesses={businesses}
          product={product}
          submitLabel="更新する"
        />
      </div>

      <div className="mx-auto mt-8 max-w-lg">
        <p className="mb-2 text-xs text-muted">この商品を削除する場合:</p>
        <form action={deleteProductAction}>
          <input type="hidden" name="id" value={product.id} />
          <input type="hidden" name="businessId" value={product.business_id} />
          <DeleteConfirmButton message="この商品を削除してよろしいですか？" />
        </form>
      </div>
    </div>
  );
}

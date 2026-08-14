import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { createProductAction } from "../actions";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { SINGLE_BUSINESS_ID } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "商品 新規登録" };

export default async function AdminProductsNewPage() {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/login?next=/admin/products/new");

  const businesses = await findManageableBusinesses();

  const returnPath = `/admin/products?businessId=${SINGLE_BUSINESS_ID}`;

  return (
    <div>
      <Link href={returnPath} className="text-sm text-primary hover:underline">
        ← 商品管理
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-foreground">商品 新規登録</h2>

      <div className="mt-8">
        {businesses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-6 py-8 text-sm text-muted">
            操作可能な事業がありません。事業割当を確認してください。
          </p>
        ) : (
          <ProductForm
            action={createProductAction}
            businesses={businesses}
            defaultBusinessId={SINGLE_BUSINESS_ID}
            submitLabel="登録する"
          />
        )}
      </div>
    </div>
  );
}

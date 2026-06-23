import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { createProductAction } from "../actions";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "商品 新規登録" };

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AdminProductsNewPage({ searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products/new");

  const { businessId } = await searchParams;

  const businesses = await findManageableBusinesses();

  const returnPath = businessId
    ? `/admin/products?businessId=${businessId}`
    : "/admin/products";

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
            defaultBusinessId={businessId}
            submitLabel="登録する"
          />
        )}
      </div>
    </div>
  );
}

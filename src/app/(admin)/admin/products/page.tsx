import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { getProductsForBusiness } from "@/lib/services/product.service";
import { hasPermission } from "@/lib/permissions";
import { SINGLE_BUSINESS_ID } from "@/lib/feature-flags";
import type { Product } from "@/types/database";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "商品管理" };

const STATUS_LABELS: Record<string, string> = {
  on_sale: "販売中",
  off_sale: "販売停止",
  archived: "アーカイブ",
};

const STATUS_COLORS: Record<string, string> = {
  on_sale: "text-green-700 bg-green-50 border-green-200",
  off_sale: "text-yellow-700 bg-yellow-50 border-yellow-200",
  archived: "text-slate-500 bg-slate-50 border-slate-200",
};

export default async function AdminProductsPage() {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/login?next=/admin/products");

  if (!hasPermission(session.profile.role, "PRODUCT_MANAGE")) {
    redirect("/admin");
  }

  const businesses = await findManageableBusinesses();
  const business = businesses[0];

  let products: Product[] | null = null;
  let productsError: string | null = null;

  if (business) {
    const result = await getProductsForBusiness(session.profile, SINGLE_BUSINESS_ID);
    if (result.ok) {
      products = result.data;
    } else {
      productsError = result.error;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">商品管理</h2>
        <div className="flex items-center gap-2">
          {business && (
            <>
              <Link
                href={`/admin/products/sales?businessId=${SINGLE_BUSINESS_ID}`}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-slate-50"
              >
                販売記録
              </Link>
              <Link
                href={`/admin/products/new?businessId=${SINGLE_BUSINESS_ID}`}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
              >
                + 商品追加
              </Link>
            </>
          )}
        </div>
      </div>

      {productsError && <p className="mt-4 text-sm text-red-600">{productsError}</p>}

      {!business && (
        <p className="mt-4 text-sm text-muted">
          操作可能な事業がありません。
        </p>
      )}

      {business && products !== null && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted">
            事業: <span className="font-medium text-foreground">{business.name}</span>
          </p>
          {products.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted">
              商品が登録されていません。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium">商品名</th>
                    <th className="px-4 py-3 text-right font-medium">税抜き価格</th>
                    <th className="px-4 py-3 text-center font-medium">在庫</th>
                    <th className="px-4 py-3 text-center font-medium">ステータス</th>
                    <th className="px-4 py-3 text-center font-medium">EC公開</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.name}</div>
                        {p.description && (
                          <div className="mt-0.5 text-xs text-muted line-clamp-1">
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        ¥{p.price_excluding_tax.toLocaleString()}
                      </td>
                      <td className={`px-4 py-3 text-center ${p.stock_quantity === 0 ? "text-red-500 font-medium" : ""}`}>
                        {p.stock_quantity !== null ? p.stock_quantity.toLocaleString() : "∞"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS_COLORS[p.status] ?? ""}`}
                        >
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs ${
                            p.is_published_online
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                          }`}
                        >
                          {p.is_published_online ? "公開中" : "非公開"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          className="text-sm text-muted hover:underline"
                        >
                          編集
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

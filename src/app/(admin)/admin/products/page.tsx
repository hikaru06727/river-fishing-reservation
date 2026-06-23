import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { getProductsForBusiness } from "@/lib/services/product.service";
import { isAdminRole } from "@/lib/auth/role";
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

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products");

  const { businessId } = await searchParams;
  const isAdmin = isAdminRole(session.profile.role);

  const businesses = await findManageableBusinesses();

  if (!businessId && !isAdmin && businesses.length === 1 && businesses[0]) {
    redirect(`/admin/products?businessId=${businesses[0].id}`);
  }

  let products: Product[] | null = null;
  let productsError: string | null = null;

  if (businessId) {
    const result = await getProductsForBusiness(session.profile, businessId);
    if (result.ok) {
      products = result.data;
    } else {
      productsError = result.error;
    }
  }

  const selectedBusiness = businesses.find((b) => b.id === businessId);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">商品管理</h2>
        <div className="flex items-center gap-2">
          {businessId && (
            <>
              <Link
                href={`/admin/products/sales?businessId=${businessId}`}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-slate-50"
              >
                販売記録
              </Link>
              <Link
                href={`/admin/products/new?businessId=${businessId}`}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
              >
                + 商品追加
              </Link>
            </>
          )}
        </div>
      </div>

      {businesses.length > 1 && (
        <form method="get" action="/admin/products" className="mt-4">
          <label htmlFor="businessId" className="block text-sm font-medium">
            事業を選択
          </label>
          <div className="mt-1 flex items-center gap-2">
            <select
              name="businessId"
              id="businessId"
              defaultValue={businessId ?? ""}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              <option value="">-- 事業を選択 --</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-slate-50"
            >
              表示
            </button>
          </div>
        </form>
      )}

      {productsError && <p className="mt-4 text-sm text-red-600">{productsError}</p>}

      {!businessId && (
        <p className="mt-4 text-sm text-muted">
          {businesses.length === 0
            ? "操作可能な事業がありません。"
            : "事業を選択して商品を表示します。"}
        </p>
      )}

      {businessId && products !== null && (
        <div className="mt-4">
          {selectedBusiness && (
            <p className="mb-2 text-sm text-muted">
              事業:{" "}
              <span className="font-medium text-foreground">{selectedBusiness.name}</span>
            </p>
          )}
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
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const canSell =
                      p.status === "on_sale" &&
                      (p.stock_quantity === null || p.stock_quantity > 0);
                    return (
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {canSell ? (
                            <Link
                              href={`/admin/products/${p.id}/sell`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              販売登録
                            </Link>
                          ) : (
                            <span className="text-sm text-slate-300 cursor-not-allowed">
                              販売登録
                            </span>
                          )}
                          <Link
                            href={`/admin/products/${p.id}/edit`}
                            className="text-sm text-muted hover:underline"
                          >
                            編集
                          </Link>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

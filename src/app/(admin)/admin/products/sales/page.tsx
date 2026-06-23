import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { findProductsByBusinessId } from "@/lib/repositories/products.repository";
import { getProductSalesForBusiness } from "@/lib/services/product.service";
import { isAdminRole } from "@/lib/auth/role";
import { ProductSaleForm } from "@/components/admin/ProductSaleForm";
import { createProductSaleAction, deleteProductSaleAction } from "../actions";
import type { Product, ProductSale } from "@/types/database";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "商品販売記録" };

const PAYMENT_LABELS: Record<string, string> = {
  cash: "現金",
  stripe: "Stripe",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "決済待ち",
  completed: "確定",
  refunded: "返金済み",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-700 bg-yellow-50 border-yellow-200",
  completed: "text-green-700 bg-green-50 border-green-200",
  refunded: "text-slate-500 bg-slate-50 border-slate-200",
};

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AdminProductSalesPage({ searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products/sales");

  const { businessId } = await searchParams;
  const isAdmin = isAdminRole(session.profile.role);

  const businesses = await findManageableBusinesses();

  if (!businessId && !isAdmin && businesses.length === 1 && businesses[0]) {
    redirect(`/admin/products/sales?businessId=${businesses[0].id}`);
  }

  let sales: ProductSale[] | null = null;
  let salesError: string | null = null;
  let products: Product[] = [];

  if (businessId) {
    const [salesResult, productsData] = await Promise.all([
      getProductSalesForBusiness(session.profile, businessId),
      findProductsByBusinessId(businessId),
    ]);

    if (salesResult.ok) {
      sales = salesResult.data;
    } else {
      salesError = salesResult.error;
    }
    products = productsData;
  }

  const selectedBusiness = businesses.find((b) => b.id === businessId);
  const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">商品販売記録</h2>
        {businessId && (
          <Link
            href={`/admin/products?businessId=${businessId}`}
            className="text-sm text-primary hover:underline"
          >
            ← 商品管理
          </Link>
        )}
      </div>

      {businesses.length > 1 && (
        <form method="get" action="/admin/products/sales" className="mt-4">
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

      {salesError && <p className="mt-4 text-sm text-red-600">{salesError}</p>}

      {!businessId && (
        <p className="mt-4 text-sm text-muted">
          {businesses.length === 0
            ? "操作可能な事業がありません。"
            : "事業を選択して販売記録を表示します。"}
        </p>
      )}

      {businessId && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-foreground">現地販売を登録</h3>
          {selectedBusiness && businesses.length === 1 ? (
            <ProductSaleForm
              action={createProductSaleAction}
              businesses={businesses}
              products={products}
              defaultBusinessId={businessId}
            />
          ) : (
            <ProductSaleForm
              action={createProductSaleAction}
              businesses={businesses}
              products={products}
              defaultBusinessId={businessId}
            />
          )}
        </div>
      )}

      {businessId && sales !== null && (
        <div className="mt-8">
          {selectedBusiness && (
            <p className="mb-2 text-sm text-muted">
              事業:{" "}
              <span className="font-medium text-foreground">{selectedBusiness.name}</span>
            </p>
          )}
          <h3 className="mb-3 text-sm font-semibold text-foreground">販売履歴</h3>
          {sales.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted">
              販売記録がありません。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium">日時</th>
                    <th className="px-4 py-3 text-left font-medium">商品</th>
                    <th className="px-4 py-3 text-center font-medium">数量</th>
                    <th className="px-4 py-3 text-right font-medium">単価（税抜）</th>
                    <th className="px-4 py-3 text-center font-medium">税率</th>
                    <th className="px-4 py-3 text-left font-medium">支払方法</th>
                    <th className="px-4 py-3 text-center font-medium">状態</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted">
                        {new Date(s.purchased_at).toLocaleString("ja-JP", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {productMap[s.product_id] ?? s.product_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-center">{s.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        ¥{s.unit_price_excluding_tax.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">{s.tax_rate_percent}%</td>
                      <td className="px-4 py-3">
                        {PAYMENT_LABELS[s.payment_method] ?? s.payment_method}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS_COLORS[s.status] ?? ""}`}
                        >
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <form action={deleteProductSaleAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="businessId" value={businessId} />
                          <DeleteConfirmButton
                            message="この販売記録を削除してよろしいですか？"
                            label="削除"
                            className="text-xs text-red-500 hover:underline"
                          />
                        </form>
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

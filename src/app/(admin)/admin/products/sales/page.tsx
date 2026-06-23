import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { getSaleSessionsForBusiness } from "@/lib/services/sale-session.service";
import { isAdminRole } from "@/lib/auth/role";
import { POS_PAYMENT_METHODS } from "@/validations/pos";
import type { SaleSessionListRow } from "@/lib/sales/sale-session-types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "販売履歴" };

interface PageProps {
  searchParams: Promise<{
    businessId?: string;
    dateFrom?: string;
    dateTo?: string;
    paymentMethod?: string;
  }>;
}

export default async function AdminProductSalesPage({ searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products/sales");

  const { businessId, dateFrom, dateTo, paymentMethod } = await searchParams;
  const isAdmin = isAdminRole(session.profile.role);

  const businesses = await findManageableBusinesses();

  if (!businessId && !isAdmin && businesses.length === 1 && businesses[0]) {
    redirect(`/admin/products/sales?businessId=${businesses[0].id}`);
  }

  let sessions: SaleSessionListRow[] | null = null;
  let sessionsError: string | null = null;

  if (businessId) {
    const result = await getSaleSessionsForBusiness(session.profile, businessId, {
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      paymentMethod: paymentMethod || null,
    });
    if (result.ok) {
      sessions = result.data;
    } else {
      sessionsError = result.error;
    }
  }

  const selectedBusiness = businesses.find((b) => b.id === businessId);

  const filterTotal = sessions?.reduce((s, r) => s + r.total_amount, 0) ?? 0;
  const hasActiveFilter = dateFrom || dateTo || paymentMethod;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">販売履歴</h2>
        {businessId && (
          <Link
            href={`/admin/pos?businessId=${businessId}`}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
          >
            レジへ
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

      {/* 絞り込みフィルター */}
      {businessId && (
        <form method="get" action="/admin/products/sales" className="mt-4 rounded-xl border border-border bg-slate-50 p-4">
          <input type="hidden" name="businessId" value={businessId} />
          <p className="mb-3 text-xs font-semibold text-muted">絞り込み</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-muted">開始日</label>
              <input
                name="dateFrom"
                type="date"
                defaultValue={dateFrom ?? ""}
                className="mt-1 rounded-lg border border-border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted">終了日</label>
              <input
                name="dateTo"
                type="date"
                defaultValue={dateTo ?? ""}
                className="mt-1 rounded-lg border border-border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted">支払方法</label>
              <select
                name="paymentMethod"
                defaultValue={paymentMethod ?? ""}
                className="mt-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
              >
                <option value="">すべて</option>
                {POS_PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg border border-border bg-white px-4 py-1.5 text-sm hover:bg-slate-100"
            >
              絞り込む
            </button>
            {hasActiveFilter && (
              <Link
                href={`/admin/products/sales?businessId=${businessId}`}
                className="text-xs text-primary hover:underline"
              >
                クリア
              </Link>
            )}
          </div>
        </form>
      )}

      {sessionsError && <p className="mt-4 text-sm text-red-600">{sessionsError}</p>}

      {!businessId && (
        <p className="mt-4 text-sm text-muted">
          {businesses.length === 0
            ? "操作可能な事業がありません。"
            : "事業を選択して販売履歴を表示します。"}
        </p>
      )}

      {businessId && sessions !== null && (
        <div className="mt-6">
          {selectedBusiness && (
            <p className="mb-2 text-sm text-muted">
              事業:{" "}
              <span className="font-medium text-foreground">{selectedBusiness.name}</span>
            </p>
          )}

          {sessions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted">
              {hasActiveFilter ? "条件に一致する販売履歴がありません。" : "販売履歴がありません。"}
            </p>
          ) : (
            <>
              {/* 合計表示 */}
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted">{sessions.length}件</span>
                <span className="font-semibold text-foreground">
                  合計 ¥{filterTotal.toLocaleString()}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50">
                      <th className="px-4 py-3 text-left font-medium">販売日時</th>
                      <th className="px-4 py-3 text-center font-medium">商品数</th>
                      <th className="px-4 py-3 text-left font-medium">支払方法</th>
                      <th className="px-4 py-3 text-right font-medium">税抜合計</th>
                      <th className="px-4 py-3 text-right font-medium">消費税</th>
                      <th className="px-4 py-3 text-right font-medium">税込合計</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => {
                      const pmLabel = POS_PAYMENT_METHODS.find((m) => m.value === s.payment_method)?.label
                        ?? s.payment_method;
                      return (
                        <tr key={s.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 text-muted">
                            {new Date(s.sold_at).toLocaleString("ja-JP", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-3 text-center">{s.item_count}種</td>
                          <td className="px-4 py-3">
                            {pmLabel}
                            {s.payment_other_label ? `（${s.payment_other_label}）` : ""}
                          </td>
                          <td className="px-4 py-3 text-right">
                            ¥{(s.subtotal_amount - s.discount_amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">¥{s.tax_amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            ¥{s.total_amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/products/sales/${s.id}`}
                              className="text-sm text-primary hover:underline"
                            >
                              詳細
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

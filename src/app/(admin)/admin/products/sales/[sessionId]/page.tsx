import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";
import { getSaleSessionDetail } from "@/lib/services/sale-session.service";
import { POS_PAYMENT_METHODS } from "@/validations/pos";
import { PrintButton } from "@/components/admin/PrintButton";
import { RefundButton } from "@/components/refund/RefundButton";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "販売詳細" };

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function AdminSaleSessionDetailPage({ params }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/products/sales");

  const { sessionId } = await params;

  const result = await getSaleSessionDetail(session.profile, sessionId);

  if (!result.ok) {
    if (result.status === 404) notFound();
    redirect("/admin/products/sales");
  }

  const detail = result.data;
  const returnPath = `/admin/products/sales?businessId=${detail.business_id}`;
  const pmLabel =
    POS_PAYMENT_METHODS.find((m) => m.value === detail.payment_method)?.label ??
    detail.payment_method;

  const itemDiscounts = detail.discounts.filter((d) => d.target === "item");
  const sessionDiscounts = detail.discounts.filter((d) => d.target === "session");

  return (
    <div>
      {/* 印刷時非表示 */}
      <div className="print:hidden flex items-center justify-between">
        <Link href={returnPath} className="text-sm text-primary hover:underline">
          ← 販売履歴
        </Link>
        <div className="flex items-center gap-2">
          {hasPermission(session.profile.role, "REFUND_MANAGE") && (
            <RefundButton
              businessId={detail.business_id}
              target={{ type: "saleSession", id: sessionId }}
              maxAmount={detail.total_amount}
            />
          )}
          <PrintButton />
        </div>
      </div>

      <h2 className="mt-4 text-lg font-semibold text-foreground print:mt-0">販売詳細</h2>

      {/* ヘッダー情報 */}
      <div className="mt-4 rounded-xl border border-border bg-slate-50 p-4 print:border-none print:bg-white print:p-0">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">販売日時</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {new Date(detail.sold_at).toLocaleString("ja-JP", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-muted">支払方法</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {pmLabel}
              {detail.payment_other_label ? `（${detail.payment_other_label}）` : ""}
            </dd>
          </div>
          {detail.note && (
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-muted">備考</dt>
              <dd className="mt-0.5 text-foreground">{detail.note}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* 商品明細 */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-foreground">商品明細</h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="px-4 py-3 text-left font-medium">商品名</th>
                <th className="px-4 py-3 text-center font-medium">数量</th>
                <th className="px-4 py-3 text-right font-medium">単価（税抜）</th>
                <th className="px-4 py-3 text-center font-medium">税率</th>
                <th className="px-4 py-3 text-right font-medium">割引</th>
                <th className="px-4 py-3 text-right font-medium">小計（税抜）</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => {
                const itemDiscount = itemDiscounts.find((d) => d.target_item_id === item.id);
                const discountAmt = itemDiscount?.discount_amount ?? 0;
                const net = item.subtotal - discountAmt;
                return (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{item.product_name}</td>
                    <td className="px-4 py-3 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">
                      ¥{item.unit_price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center text-muted">
                      {item.tax_rate_percent}%
                    </td>
                    <td className="px-4 py-3 text-right text-green-700">
                      {discountAmt > 0
                        ? `−¥${discountAmt.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">¥{net.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 割引内訳 */}
      {detail.discounts.length > 0 && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 print:border-none print:bg-white">
          <h3 className="mb-2 text-sm font-semibold text-green-800">割引内訳</h3>
          <ul className="space-y-1 text-sm">
            {detail.discounts.map((d) => {
              const targetLabel = d.target === "session"
                ? "全体割引"
                : `商品割引`;
              const valueLabel =
                d.discount_type === "amount"
                  ? `¥${Number(d.discount_value).toLocaleString()}引き`
                  : `${d.discount_value}%OFF`;
              return (
                <li key={d.id} className="flex justify-between text-green-800">
                  <span>{targetLabel}（{valueLabel}）</span>
                  <span>−¥{d.discount_amount.toLocaleString()}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 合計 */}
      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-muted">
            <dt>税抜合計（割引前）</dt>
            <dd>¥{detail.subtotal_amount.toLocaleString()}</dd>
          </div>
          {detail.discount_amount > 0 && (
            <div className="flex justify-between text-green-700">
              <dt>割引合計</dt>
              <dd>−¥{detail.discount_amount.toLocaleString()}</dd>
            </div>
          )}
          {sessionDiscounts.length > 0 && (
            <div className="flex justify-between text-muted">
              <dt>税抜合計（割引後）</dt>
              <dd>¥{(detail.subtotal_amount - detail.discount_amount).toLocaleString()}</dd>
            </div>
          )}
          <div className="flex justify-between text-muted">
            <dt>消費税（{detail.tax_rate_percent}% 基準）</dt>
            <dd>¥{detail.tax_amount.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
            <dt>税込合計</dt>
            <dd>¥{detail.total_amount.toLocaleString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

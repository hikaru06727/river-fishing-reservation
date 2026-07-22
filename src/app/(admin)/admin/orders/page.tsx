import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import {
  getOnlineOrdersForBusiness,
  getTodaysPickupOrders,
} from "@/lib/services/online-order.service";
import { isAdminRole } from "@/lib/auth/role";
import {
  ONLINE_ORDER_FULFILLMENT_LABEL,
  ONLINE_ORDER_PAYMENT_METHOD_LABEL,
  ONLINE_ORDER_PAYMENT_STATUS_LABEL,
  ONLINE_ORDER_STATUS_LABEL,
} from "@/lib/online-orders/labels";
import { formatPickupTimeJst } from "@/lib/online-orders/pickup-schedule";
import { formatDateTime, formatYen } from "@/lib/utils/format";
import type { OnlineOrderItemRow, OnlineOrderRow } from "@/types/database";
import type {
  OnlineOrderFulfillmentType,
  OnlineOrderPaymentMethod,
  OnlineOrderStatus,
} from "@/types/domain";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "注文管理" };

type OrdersTab = "list" | "today-pickup";

interface AdminOrdersPageProps {
  searchParams: Promise<{
    businessId?: string;
    tab?: string;
    status?: string;
    fulfillmentType?: string;
    paymentMethod?: string;
  }>;
}

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/login?next=/admin/orders");

  const { businessId, tab, status, fulfillmentType, paymentMethod } = await searchParams;
  const isAdmin = isAdminRole(session.profile.role);
  const activeTab: OrdersTab = tab === "today-pickup" ? "today-pickup" : "list";

  const businesses = await findManageableBusinesses();

  if (!businessId && !isAdmin && businesses.length === 1 && businesses[0]) {
    redirect(`/admin/orders?businessId=${businesses[0].id}`);
  }

  let orders: OnlineOrderRow[] | null = null;
  let ordersError: string | null = null;
  let todaysPickups: Array<{ order: OnlineOrderRow; items: OnlineOrderItemRow[] }> | null = null;
  let todaysPickupsError: string | null = null;

  if (businessId && activeTab === "list") {
    const result = await getOnlineOrdersForBusiness(session.profile, businessId, {
      status: (status as OnlineOrderStatus) || undefined,
      fulfillmentType: (fulfillmentType as OnlineOrderFulfillmentType) || undefined,
      paymentMethod: (paymentMethod as OnlineOrderPaymentMethod) || undefined,
    });
    if (result.ok) {
      orders = result.data;
    } else {
      ordersError = result.error;
    }
  }

  if (businessId && activeTab === "today-pickup") {
    const result = await getTodaysPickupOrders(session.profile, businessId);
    if (result.ok) {
      todaysPickups = result.data;
    } else {
      todaysPickupsError = result.error;
    }
  }

  const selectedBusiness = businesses.find((b) => b.id === businessId);
  const hasActiveFilter = status || fulfillmentType || paymentMethod;

  const tabHref = (t: OrdersTab) =>
    `/admin/orders?${new URLSearchParams({ ...(businessId ? { businessId } : {}), tab: t }).toString()}`;

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">注文管理</h2>

      <div className="mt-4 flex gap-2 border-b border-border">
        <Link
          href={tabHref("list")}
          className={`px-3 py-2 text-sm font-medium ${
            activeTab === "list"
              ? "border-b-2 border-primary text-primary"
              : "text-muted hover:text-foreground"
          }`}
        >
          注文一覧
        </Link>
        <Link
          href={tabHref("today-pickup")}
          className={`px-3 py-2 text-sm font-medium ${
            activeTab === "today-pickup"
              ? "border-b-2 border-primary text-primary"
              : "text-muted hover:text-foreground"
          }`}
        >
          本日の受け取り予定
        </Link>
      </div>

      {businesses.length > 1 && (
        <form method="get" action="/admin/orders" className="mt-4">
          <input type="hidden" name="tab" value={activeTab} />
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

      {businessId && activeTab === "list" && (
        <form method="get" action="/admin/orders" className="mt-4 rounded-xl border border-border bg-slate-50 p-4">
          <input type="hidden" name="businessId" value={businessId} />
          <input type="hidden" name="tab" value="list" />
          <p className="mb-3 text-xs font-semibold text-muted">絞り込み</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-muted">ステータス</label>
              <select
                name="status"
                defaultValue={status ?? ""}
                className="mt-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
              >
                <option value="">すべて</option>
                {Object.entries(ONLINE_ORDER_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted">受け取り方法</label>
              <select
                name="fulfillmentType"
                defaultValue={fulfillmentType ?? ""}
                className="mt-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
              >
                <option value="">すべて</option>
                {Object.entries(ONLINE_ORDER_FULFILLMENT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted">決済方法</label>
              <select
                name="paymentMethod"
                defaultValue={paymentMethod ?? ""}
                className="mt-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm"
              >
                <option value="">すべて</option>
                {Object.entries(ONLINE_ORDER_PAYMENT_METHOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
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
                href={`/admin/orders?businessId=${businessId}&tab=list`}
                className="text-xs text-primary hover:underline"
              >
                クリア
              </Link>
            )}
          </div>
        </form>
      )}

      {activeTab === "list" && ordersError && (
        <p className="mt-4 text-sm text-red-600">{ordersError}</p>
      )}
      {activeTab === "today-pickup" && todaysPickupsError && (
        <p className="mt-4 text-sm text-red-600">{todaysPickupsError}</p>
      )}

      {!businessId && (
        <p className="mt-4 text-sm text-muted">
          {businesses.length === 0
            ? "操作可能な事業がありません。"
            : "事業を選択して注文一覧を表示します。"}
        </p>
      )}

      {businessId && activeTab === "list" && orders !== null && (
        <div className="mt-6">
          {selectedBusiness && (
            <p className="mb-2 text-sm text-muted">
              事業:{" "}
              <span className="font-medium text-foreground">{selectedBusiness.name}</span>
            </p>
          )}

          {orders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted">
              {hasActiveFilter ? "条件に一致する注文がありません。" : "注文がありません。"}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium">注文番号</th>
                    <th className="px-4 py-3 text-left font-medium">注文日時</th>
                    <th className="px-4 py-3 text-left font-medium">顧客名</th>
                    <th className="px-4 py-3 text-right font-medium">合計金額</th>
                    <th className="px-4 py-3 text-left font-medium">受け取り方法</th>
                    <th className="px-4 py-3 text-left font-medium">決済方法</th>
                    <th className="px-4 py-3 text-left font-medium">支払い状況</th>
                    <th className="px-4 py-3 text-left font-medium">ステータス</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{order.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-muted">{formatDateTime(order.created_at)}</td>
                      <td className="px-4 py-3">{order.customer_name}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatYen(order.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        {ONLINE_ORDER_FULFILLMENT_LABEL[order.fulfillment_type]}
                      </td>
                      <td className="px-4 py-3">
                        {ONLINE_ORDER_PAYMENT_METHOD_LABEL[order.payment_method]}
                      </td>
                      <td className="px-4 py-3">
                        {ONLINE_ORDER_PAYMENT_STATUS_LABEL[order.payment_status]}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          詳細
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

      {businessId && activeTab === "today-pickup" && todaysPickups !== null && (
        <div className="mt-6">
          {selectedBusiness && (
            <p className="mb-2 text-sm text-muted">
              事業:{" "}
              <span className="font-medium text-foreground">{selectedBusiness.name}</span>
            </p>
          )}

          {todaysPickups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted">
              本日受け取り予定の注文はありません。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium">確認コード</th>
                    <th className="px-4 py-3 text-left font-medium">顧客名</th>
                    <th className="px-4 py-3 text-left font-medium">商品一覧</th>
                    <th className="px-4 py-3 text-left font-medium">希望受け取り時刻</th>
                    <th className="px-4 py-3 text-left font-medium">ステータス</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {todaysPickups.map(({ order, items }) => (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-mono text-sm font-semibold">
                        {order.confirmation_code ?? "—"}
                      </td>
                      <td className="px-4 py-3">{order.customer_name}</td>
                      <td className="px-4 py-3 text-muted">
                        {items.map((i) => `${i.product_name} x${i.quantity}`).join("、")}
                      </td>
                      <td className="px-4 py-3">
                        {order.pickup_date ? formatPickupTimeJst(order.pickup_date) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          詳細
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

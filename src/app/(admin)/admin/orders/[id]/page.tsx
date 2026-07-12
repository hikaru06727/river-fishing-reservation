import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminAdvanceOrderStatusButton } from "@/components/admin/orders/AdminAdvanceOrderStatusButton";
import { AdminConfirmOrderPickupButton } from "@/components/admin/orders/AdminConfirmOrderPickupButton";
import { OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";
import { Card } from "@/components/ui/Card";
import { RefundButton } from "@/components/refund/RefundButton";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { canCurrentUserManageOnlineOrder } from "@/lib/auth/management-access";
import { hasPermission } from "@/lib/permissions";
import {
  ONLINE_ORDER_FULFILLMENT_LABEL,
  ONLINE_ORDER_PAYMENT_METHOD_LABEL,
  ONLINE_ORDER_PAYMENT_STATUS_LABEL,
} from "@/lib/online-orders/labels";
import {
  getNextOnlineOrderStatus,
  getOnlineOrderDetailForAdmin,
} from "@/lib/services/online-order.service";
import { formatDateTime, formatYen } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface AdminOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AdminOrderDetailPageProps) {
  const { id } = await params;
  return { title: `注文詳細 ${id.slice(0, 8)}…` };
}

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailPageProps) {
  const { id } = await params;

  const session = await getAuthenticatedManagement();
  if (!session) redirect(`/admin/login?next=/admin/orders/${id}`);

  const canManage = await canCurrentUserManageOnlineOrder(id);
  if (!canManage) {
    redirect("/admin/orders");
  }

  const detail = await getOnlineOrderDetailForAdmin(id);
  if (!detail) {
    notFound();
  }

  const { order, items } = detail;
  const returnTo = `/admin/orders/${id}`;
  const canManageStatus = hasPermission(session.profile.role, "ORDER_STATUS_MANAGE");
  const nextStatus = getNextOnlineOrderStatus(order.status, order.fulfillment_type);
  const isAwaitingPickupConfirmation =
    order.payment_method === "in_person" && order.payment_status !== "paid";
  const canRefund =
    order.payment_status === "paid" && hasPermission(session.profile.role, "REFUND_MANAGE");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/orders" className="text-sm text-primary hover:underline">
            ← 注文一覧に戻る
          </Link>
          <h2 className="mt-2 text-lg font-semibold text-foreground">注文詳細</h2>
          <p className="mt-1 font-mono text-xs text-muted">{order.id}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-foreground">注文情報</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">注文日時</dt>
              <dd>{formatDateTime(order.created_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">受け取り方法</dt>
              <dd>{ONLINE_ORDER_FULFILLMENT_LABEL[order.fulfillment_type]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">決済方法</dt>
              <dd>{ONLINE_ORDER_PAYMENT_METHOD_LABEL[order.payment_method]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">支払い状況</dt>
              <dd>{ONLINE_ORDER_PAYMENT_STATUS_LABEL[order.payment_status]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">小計（税抜）</dt>
              <dd>{formatYen(order.subtotal_amount)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">消費税</dt>
              <dd>{formatYen(order.tax_amount)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">合計金額（税込）</dt>
              <dd className="font-semibold">{formatYen(order.total_amount)}</dd>
            </div>
            {order.linked_reservation_id && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">紐づく予約</dt>
                <dd>
                  <Link
                    href={`/admin/reservations/${order.linked_reservation_id}`}
                    className="text-primary hover:underline"
                  >
                    予約詳細を見る
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <h3 className="font-semibold text-foreground">顧客情報</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">氏名</dt>
              <dd>{order.customer_name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">メール</dt>
              <dd className="break-all">{order.customer_email}</dd>
            </div>
            {order.customer_phone && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">電話番号</dt>
                <dd>{order.customer_phone}</dd>
              </div>
            )}
            {order.fulfillment_type === "shipping" && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">郵便番号</dt>
                  <dd>{order.shipping_postal_code ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">配送先住所</dt>
                  <dd className="text-right">
                    {order.shipping_prefecture}
                    {order.shipping_address_line1}
                    {order.shipping_address_line2 ? ` ${order.shipping_address_line2}` : ""}
                  </dd>
                </div>
              </>
            )}
            {order.notes && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">備考</dt>
                <dd className="text-right">{order.notes}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-foreground">ご注文商品</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-2 font-medium">商品名</th>
                <th className="py-2 text-right font-medium">単価（税抜）</th>
                <th className="py-2 text-right font-medium">数量</th>
                <th className="py-2 text-right font-medium">小計</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2">{item.product_name}</td>
                  <td className="py-2 text-right">{formatYen(item.unit_price)}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">{formatYen(item.unit_price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {canRefund && (
        <Card>
          <h3 className="font-semibold text-foreground">返金</h3>
          <div className="mt-3">
            <RefundButton
              businessId={order.business_id}
              target={{
                type: "onlineOrder",
                id: order.id,
                stripePaymentIntentId: order.stripe_payment_intent_id,
              }}
              maxAmount={order.total_amount}
            />
          </div>
        </Card>
      )}

      {canManageStatus && (isAwaitingPickupConfirmation || nextStatus) && (
        <Card>
          <h3 className="font-semibold text-foreground">ステータス操作</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {isAwaitingPickupConfirmation ? (
              <AdminConfirmOrderPickupButton orderId={order.id} returnTo={returnTo} />
            ) : (
              nextStatus && (
                <AdminAdvanceOrderStatusButton
                  orderId={order.id}
                  nextStatus={nextStatus}
                  returnTo={returnTo}
                />
              )
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

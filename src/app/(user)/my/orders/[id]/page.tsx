import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";
import { Card } from "@/components/ui/Card";
import { getUser } from "@/lib/auth/get-user";
import {
  ONLINE_ORDER_FULFILLMENT_LABEL,
  ONLINE_ORDER_PAYMENT_METHOD_LABEL,
  ONLINE_ORDER_PAYMENT_STATUS_LABEL,
} from "@/lib/online-orders/labels";
import { getMyOnlineOrderDetail } from "@/lib/services/online-order.service";
import { formatDateTime, formatYen } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface MyOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: "注文詳細" };
}

export default async function MyOrderDetailPage({ params }: MyOrderDetailPageProps) {
  const { id } = await params;

  const user = await getUser();
  if (!user) {
    redirect(`/login?next=/my/orders/${id}`);
  }

  const detail = await getMyOnlineOrderDetail(id, user.id);
  if (!detail) {
    notFound();
  }

  const { order, items } = detail;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/my/orders" className="text-sm text-muted hover:text-primary">
            ← マイ注文に戻る
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">注文詳細</h1>
          <p className="mt-1 font-mono text-xs text-muted">{order.id}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      <Card>
        <h2 className="font-semibold text-foreground">注文情報</h2>
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
          <div className="flex justify-between gap-4 border-t border-border pt-3">
            <dt className="text-muted">合計金額（税込）</dt>
            <dd className="font-semibold">{formatYen(order.total_amount)}</dd>
          </div>
          {order.confirmation_code && order.payment_method === "in_person" && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">受け取り確認コード</dt>
              <dd className="font-mono font-semibold">{order.confirmation_code}</dd>
            </div>
          )}
        </dl>
      </Card>

      {order.fulfillment_type === "shipping" && (
        <Card>
          <h2 className="font-semibold text-foreground">配送先</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">郵便番号</dt>
              <dd>{order.shipping_postal_code ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">住所</dt>
              <dd className="text-right">
                {order.shipping_prefecture}
                {order.shipping_address_line1}
                {order.shipping_address_line2 ? ` ${order.shipping_address_line2}` : ""}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-foreground">ご注文商品</h2>
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
    </div>
  );
}

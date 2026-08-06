import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";
import { formatDateTime, formatYen } from "@/lib/utils/format";
import type { OnlineOrderRow } from "@/types/database";

interface LinkedOrdersCardProps {
  orders: OnlineOrderRow[];
  /** 指定時、各行を注文詳細へのリンクにする（管理画面用。顧客向けはリンクなし） */
  orderHref?: (orderId: string) => string;
}

/** 予約後の追加購入（Phase 19E）の一覧表示。決済・返金・ステータスは予約から独立している。 */
export function LinkedOrdersCard({ orders, orderHref }: LinkedOrdersCardProps) {
  if (orders.length === 0) return null;

  return (
    <Card>
      <h3 className="font-semibold text-foreground">追加購入</h3>
      <p className="mt-1 text-xs text-muted">
        予約とは別会計の注文です。決済・返金・ステータスは予約から独立して管理されます。
      </p>
      <ul className="mt-3 divide-y divide-border">
        {orders.map((order) => {
          const row = (
            <div className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <p className="text-foreground">{formatDateTime(order.created_at)}</p>
                <p className="mt-0.5 text-xs text-muted">{formatYen(order.total_amount)}</p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
          );

          return (
            <li key={order.id}>
              {orderHref ? (
                <Link href={orderHref(order.id)} className="block hover:bg-slate-50">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

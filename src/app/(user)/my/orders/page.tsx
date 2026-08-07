import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";
import { Card } from "@/components/ui/Card";
import { getUser } from "@/lib/auth/get-user";
import { ONLINE_SHOP_ENABLED } from "@/lib/feature-flags";
import { ONLINE_ORDER_FULFILLMENT_LABEL } from "@/lib/online-orders/labels";
import { getMyOnlineOrders } from "@/lib/services/online-order.service";
import { formatDateTime, formatYen } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "マイ注文",
};

export default async function MyOrdersPage() {
  if (!ONLINE_SHOP_ENABLED) {
    notFound();
  }

  const user = await getUser();

  if (!user) {
    redirect("/login?next=/my/orders");
  }

  const orders = await getMyOnlineOrders(user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">マイ注文</h1>
        <p className="mt-1 text-sm text-muted">ショップでの購入履歴を確認できます</p>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-4xl" aria-hidden="true">
            🛍️
          </p>
          <p className="mt-3 font-medium text-foreground">注文履歴がありません</p>
          <p className="mt-1 text-sm text-muted">ショップで商品を購入してみましょう</p>
          <Link
            href="/shop"
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            ショップを見る
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted">{formatDateTime(order.created_at)}</p>
                    <p className="mt-0.5 font-medium text-foreground">
                      {ONLINE_ORDER_FULFILLMENT_LABEL[order.fulfillment_type]}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted">合計金額</span>
                  <span className="font-bold text-primary">{formatYen(order.total_amount)}</span>
                </div>

                <div className="mt-3">
                  <Link
                    href={`/my/orders/${order.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    詳細を見る
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

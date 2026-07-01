import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { ClearCartOnMount } from "@/components/shop/ClearCartOnMount";
import { findActiveBusinessBySlug } from "@/lib/repositories/businesses.repository";
import { getOrderForCustomer } from "@/lib/services/online-order.service";
import { formatYen } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "ご注文完了",
};

const FULFILLMENT_LABEL: Record<string, string> = {
  shipping: "配送",
  pickup: "店舗受け取り",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  stripe: "クレジットカード決済",
  in_person: "現地決済",
};

interface OrderCompletePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order_id?: string }>;
}

export default async function OrderCompletePage({ params, searchParams }: OrderCompletePageProps) {
  const { slug } = await params;
  const { order_id: orderId } = await searchParams;

  if (!orderId) {
    notFound();
  }

  const business = await findActiveBusinessBySlug(slug);
  if (!business) {
    notFound();
  }

  const result = await getOrderForCustomer(orderId, business.id);
  if (!result) {
    notFound();
  }

  const { order, items } = result;
  const paymentPending = order.payment_method === "stripe" && order.payment_status === "pending";

  return (
    <div className="space-y-6">
      <ClearCartOnMount />

      <header className="text-center">
        <p className="text-4xl" aria-hidden="true">
          ✅
        </p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">ご注文ありがとうございました</h1>
        <p className="mt-1 text-sm text-muted">注文番号: {order.id.slice(0, 8)}</p>
      </header>

      {paymentPending && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          決済の確認中です。しばらくしてもステータスが変わらない場合はお問い合わせください。
        </p>
      )}

      <Card>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">受け取り方法</dt>
            <dd className="text-foreground">{FULFILLMENT_LABEL[order.fulfillment_type]}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">決済方法</dt>
            <dd className="text-foreground">{PAYMENT_METHOD_LABEL[order.payment_method]}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt className="text-foreground">合計（税込）</dt>
            <dd className="text-primary">{formatYen(order.total_amount)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-foreground">ご注文商品</h2>
        <ul className="mt-3 divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-foreground">
                {item.product_name} x{item.quantity}
              </span>
              <span className="text-muted">{formatYen(item.unit_price * item.quantity)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Link
        href={`/shop/${slug}/products`}
        className="block text-center text-sm font-medium text-primary hover:underline"
      >
        商品一覧に戻る
      </Link>
    </div>
  );
}

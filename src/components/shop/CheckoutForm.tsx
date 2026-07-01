"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatYen } from "@/lib/utils/format";
import { submitOrderAction } from "@/app/(public)/shop/[slug]/checkout/actions";
import type { OnlineOrderFulfillmentType, OnlineOrderPaymentMethod } from "@/types/domain";

export function CheckoutForm({ slug, businessId }: { slug: string; businessId: string }) {
  const { items, totalAmount } = useCart();
  const [fulfillmentType, setFulfillmentType] = useState<OnlineOrderFulfillmentType>("pickup");
  const [paymentMethod, setPaymentMethod] = useState<OnlineOrderPaymentMethod>("stripe");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasUnshippableItem = useMemo(() => items.some((i) => !i.shippable), [items]);
  const subtotalAmount = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items],
  );
  const taxAmount = totalAmount - subtotalAmount;

  if (items.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-sm text-muted">カートが空です。</p>
        <Link
          href={`/shop/${slug}/products`}
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          商品一覧に戻る
        </Link>
      </Card>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await submitOrderAction({
      slug,
      businessId,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      fulfillmentType,
      paymentMethod,
      customerName,
      customerEmail,
      customerPhone: customerPhone || undefined,
      shippingAddress:
        fulfillmentType === "shipping"
          ? {
              postalCode,
              prefecture,
              addressLine1,
              addressLine2: addressLine2 || undefined,
            }
          : undefined,
    });

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    window.location.href = result.redirectUrl;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <h2 className="text-base font-semibold text-foreground">ご注文内容</h2>
        <ul className="mt-3 divide-y divide-border">
          {items.map((item) => (
            <li key={item.productId} className="flex items-center justify-between py-2 text-sm">
              <span className="text-foreground">
                {item.name} x{item.quantity}
              </span>
              <span className="text-muted">{formatYen(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">小計（税抜）</dt>
            <dd className="text-foreground">{formatYen(subtotalAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">消費税</dt>
            <dd className="text-foreground">{formatYen(taxAmount)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt className="text-foreground">合計（税込）</dt>
            <dd className="text-primary">{formatYen(totalAmount)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-foreground">受け取り方法</h2>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="fulfillmentType"
              checked={fulfillmentType === "pickup"}
              onChange={() => setFulfillmentType("pickup")}
              className="h-4 w-4"
            />
            店舗受け取り
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="fulfillmentType"
              checked={fulfillmentType === "shipping"}
              disabled={hasUnshippableItem}
              onChange={() => setFulfillmentType("shipping")}
              className="h-4 w-4"
            />
            配送
            {hasUnshippableItem && (
              <span className="text-xs text-red-600">
                （配送できない商品が含まれているため選択できません）
              </span>
            )}
          </label>
        </div>

        {fulfillmentType === "shipping" && (
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium">
                郵便番号 <span className="text-red-600">*</span>
              </label>
              <input
                id="postalCode"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-lg border border-border px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="prefecture" className="block text-sm font-medium">
                都道府県 <span className="text-red-600">*</span>
              </label>
              <input
                id="prefecture"
                required
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-lg border border-border px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="addressLine1" className="block text-sm font-medium">
                住所 <span className="text-red-600">*</span>
              </label>
              <input
                id="addressLine1"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-lg border border-border px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="addressLine2" className="block text-sm font-medium">
                建物名など
              </label>
              <input
                id="addressLine2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-lg border border-border px-3 text-sm"
              />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-foreground">お客様情報</h2>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="customerName" className="block text-sm font-medium">
              氏名 <span className="text-red-600">*</span>
            </label>
            <input
              id="customerName"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-lg border border-border px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="customerEmail" className="block text-sm font-medium">
              メールアドレス <span className="text-red-600">*</span>
            </label>
            <input
              id="customerEmail"
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-lg border border-border px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="customerPhone" className="block text-sm font-medium">
              電話番号
            </label>
            <input
              id="customerPhone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-lg border border-border px-3 text-sm"
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-foreground">決済方法</h2>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="paymentMethod"
              checked={paymentMethod === "stripe"}
              onChange={() => setPaymentMethod("stripe")}
              className="h-4 w-4"
            />
            クレジットカード決済
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="paymentMethod"
              checked={paymentMethod === "in_person"}
              onChange={() => setPaymentMethod("in_person")}
              className="h-4 w-4"
            />
            現地決済
          </label>
        </div>
      </Card>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting
          ? "処理中..."
          : paymentMethod === "stripe"
            ? "クレジットカードで支払う"
            : "注文を確定する"}
      </Button>
    </form>
  );
}

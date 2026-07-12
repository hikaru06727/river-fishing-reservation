"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatYen } from "@/lib/utils/format";
import type { PublicProductRow } from "@/lib/repositories/products.repository";

export type AddonSelection = { productId: string; quantity: number };

interface AddonSelectorProps {
  products: PublicProductRow[];
  disabled?: boolean;
  onChange: (items: AddonSelection[]) => void;
}

function taxIncludedPrice(product: PublicProductRow): number {
  return Math.floor(product.price_excluding_tax * (1 + product.default_tax_rate / 100));
}

function maxQuantityFor(product: PublicProductRow): number {
  if (product.track_inventory && product.stock_quantity !== null) {
    return Math.max(0, Math.min(99, product.stock_quantity));
  }
  return 99;
}

export function AddonSelector({ products, disabled, onChange }: AddonSelectorProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  if (products.length === 0) {
    return null;
  }

  function emitChange(next: Record<string, number>) {
    setQuantities(next);
    onChange(
      Object.entries(next)
        .filter(([, quantity]) => quantity > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    );
  }

  function handleQuantityChange(productId: string, quantity: number) {
    emitChange({ ...quantities, [productId]: quantity });
  }

  return (
    <Card>
      <h2 className="mb-1 text-base font-semibold">追加で商品を購入する（任意）</h2>
      <p className="mb-4 text-sm text-muted">
        この事業者は以下の商品も販売しています。ご希望の商品があれば数量を選択してください。予約時に選択した支払い方法でまとめてお支払いいただけます。
      </p>

      <ul className="space-y-3">
        {products.map((product) => {
          const maxQuantity = maxQuantityFor(product);
          const soldOut = product.track_inventory && maxQuantity === 0;
          const quantity = quantities[product.id] ?? 0;

          return (
            <li
              key={product.id}
              className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-sm text-muted">{formatYen(taxIncludedPrice(product))}（税込）</p>
                {soldOut && <p className="text-xs text-red-600">在庫切れ</p>}
              </div>
              <select
                aria-label={`${product.name}の数量`}
                value={quantity}
                disabled={disabled || soldOut}
                onChange={(e) => handleQuantityChange(product.id, Number(e.target.value))}
                className="rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                {Array.from({ length: maxQuantity + 1 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "選択しない" : `${n} 個`}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

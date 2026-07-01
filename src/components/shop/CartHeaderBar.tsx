"use client";

import Link from "next/link";
import { useCart } from "@/contexts/CartContext";

export function CartHeaderBar({ slug }: { slug: string }) {
  const { itemCount } = useCart();

  return (
    <div className="mb-4 flex items-center justify-between">
      <Link href={`/shop/${slug}/products`} className="text-sm font-medium text-foreground">
        商品一覧
      </Link>
      <Link
        href={`/shop/${slug}/checkout`}
        className="relative inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-50"
      >
        <span aria-hidden="true">🛒</span>
        カート
        {itemCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
            {itemCount}
          </span>
        )}
      </Link>
    </div>
  );
}

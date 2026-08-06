"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/Button";
import type { PublicProductDetail } from "@/types/domain";

export function AddToCartButton({ product }: { product: PublicProductDetail }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const isOutOfStock = product.track_inventory && product.stock_quantity === 0;

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 2000);
    return () => clearTimeout(timer);
  }, [added]);

  function handleClick() {
    addItem({
      productId: product.id,
      name: product.name,
      unitPrice: product.price_excluding_tax,
      taxRate: product.tax_rate_percent,
      imageUrl: product.image_url,
      trackInventory: product.track_inventory,
      stockQuantity: product.stock_quantity,
      shippable: product.shippable,
    });
    setAdded(true);
  }

  return (
    <div className="mt-4 space-y-2">
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={isOutOfStock}
        onClick={handleClick}
      >
        {isOutOfStock ? "在庫切れ" : "カートに追加"}
      </Button>
      {added && (
        <p role="status" className="text-center text-sm font-medium text-primary">
          カートに追加しました
        </p>
      )}
    </div>
  );
}

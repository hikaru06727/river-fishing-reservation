"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/contexts/CartContext";

export function ClearCartOnMount() {
  const { clearCart, hydrated } = useCart();
  const cleared = useRef(false);

  useEffect(() => {
    // CartProvider の localStorage 読み込み（マウント時 useEffect）は子コンポーネントの
    // このエフェクトより後に走る。hydrated を待たずに clearCart すると、その後の
    // 読み込みで古いカート内容に上書きされてしまうため、hydrated 完了後まで待つ。
    if (!hydrated || cleared.current) return;
    cleared.current = true;
    clearCart();
  }, [hydrated, clearCart]);

  return null;
}

"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/contexts/CartContext";

export function ClearCartOnMount() {
  const { clearCart } = useCart();
  const cleared = useRef(false);

  useEffect(() => {
    if (cleared.current) return;
    cleared.current = true;
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

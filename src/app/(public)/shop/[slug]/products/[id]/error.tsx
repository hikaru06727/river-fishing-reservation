"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface ShopProductDetailErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ShopProductDetailError({ error, reset }: ShopProductDetailErrorProps) {
  useEffect(() => {
    console.error("[ShopProductDetailPage]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <p className="text-4xl" aria-hidden="true">
        ⚠️
      </p>
      <h2 className="mt-3 text-lg font-semibold text-red-900">
        商品情報の読み込みに失敗しました
      </h2>
      <p className="mt-2 text-sm text-red-700">
        {error.message || "データの取得中にエラーが発生しました。"}
      </p>
      <div className="mt-6">
        <Button onClick={reset} variant="primary">
          再読み込み
        </Button>
      </div>
    </div>
  );
}

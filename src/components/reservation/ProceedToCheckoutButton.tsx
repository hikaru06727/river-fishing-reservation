"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface ProceedToCheckoutButtonProps {
  reservationId: string;
}

export function ProceedToCheckoutButton({ reservationId }: ProceedToCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId }),
      });

      const json = (await response.json()) as { checkout_url?: string; url?: string; error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "決済ページの作成に失敗しました");
      }

      const checkoutUrl = json.checkout_url ?? json.url;
      if (!checkoutUrl) {
        throw new Error("決済URLが取得できませんでした");
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "決済ページの作成に失敗しました");
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={loading}
        onClick={handleCheckout}
      >
        {loading ? "決済ページへ移動中..." : "カード決済へ進む"}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

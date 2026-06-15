"use client";

import { useCallback, useState } from "react";
import type { CreateReservationRequest, CreateReservationResponse } from "@/types/api";

export function useReservation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReservation = useCallback(async (data: CreateReservationRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = (await response.json()) as CreateReservationResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(json.error ?? "予約に失敗しました");
      }

      return json.reservation;
    } catch (err) {
      const message = err instanceof Error ? err.message : "予約に失敗しました";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createReservation, loading, error };
}

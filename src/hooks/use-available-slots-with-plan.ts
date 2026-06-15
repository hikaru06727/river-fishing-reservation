"use client";

import { useCallback, useEffect, useState } from "react";
import type { GetAvailableSlotsWithPlanResponse } from "@/types/api";

type UseAvailableSlotsWithPlanParams = {
  spotId: string;
  planId: string;
  guestCount?: number;
  date?: string;
};

type UseAvailableSlotsWithPlanResult = {
  data: GetAvailableSlotsWithPlanResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useAvailableSlotsWithPlan({
  spotId,
  planId,
  guestCount = 1,
  date,
}: UseAvailableSlotsWithPlanParams): UseAvailableSlotsWithPlanResult {
  const [data, setData] = useState<GetAvailableSlotsWithPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!spotId || !planId) {
      setData(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        spot_id: spotId,
        plan_id: planId,
        guest_count: String(guestCount),
      });

      if (date) {
        params.set("date", date);
      }

      try {
        const response = await fetch(`/api/slots/with-plan?${params}`, {
          signal: controller.signal,
        });

        const json = (await response.json()) as
          | GetAvailableSlotsWithPlanResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in json && json.error ? json.error : "空き枠の取得に失敗しました",
          );
        }

        setData(json as GetAvailableSlotsWithPlanResponse);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "空き枠の取得に失敗しました";
        setError(message);
        setData(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [spotId, planId, guestCount, date, fetchKey]);

  return { data, loading, error, refetch };
}

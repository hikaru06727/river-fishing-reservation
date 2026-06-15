"use client";

import { AvailabilitySlots } from "@/components/spots/AvailabilitySlots";
import { Card } from "@/components/ui/Card";
import { useAvailableSlotsWithPlan } from "@/hooks/use-available-slots-with-plan";

interface PlanAvailabilitySlotsProps {
  spotId: string;
  planId: string;
  planName: string;
}

export function PlanAvailabilitySlots({
  spotId,
  planId,
  planName,
}: PlanAvailabilitySlotsProps) {
  const { data, loading, error } = useAvailableSlotsWithPlan({
    spotId,
    planId,
    guestCount: 1,
  });

  if (loading) {
    return (
      <Card padding="sm">
        <p className="text-sm text-muted">空き枠を読み込み中...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="sm">
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{planName}</h3>
      <AvailabilitySlots slots={data?.slots ?? []} planName={planName} />
    </div>
  );
}

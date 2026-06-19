import { describe, expect, it } from "vitest";
import { getReservationPlanDisplay } from "@/lib/reservations/plan-display";

describe("Stripe checkout product name (snapshot priority)", () => {
  it("reserved_plan_name を plans.name より優先する", () => {
    const planName = getReservationPlanDisplay(
      {
        reserved_plan_name: "予約時プラン",
        plans: { name: "変更後プラン" },
      },
      { nameFallback: "プラン" },
    ).name;

    expect(planName).toBe("予約時プラン");
  });
});

import { describe, expect, it } from "vitest";
import { getReservationPlanDisplay } from "./plan-display";

describe("getReservationPlanDisplay", () => {
  it("reserved_* を plans.* より優先する", () => {
    const display = getReservationPlanDisplay({
      reserved_plan_name: "旧プラン名",
      reserved_unit_price_yen: 2500,
      reserved_duration_minutes: 120,
      plans: {
        name: "新プラン名",
        price_yen: 3000,
        duration_minutes: 60,
      },
    });

    expect(display).toEqual({
      name: "旧プラン名",
      unitPriceYen: 2500,
      durationMinutes: 120,
    });
  });

  it("reserved_* がなければ plans.* に fallback する", () => {
    const display = getReservationPlanDisplay({
      reserved_plan_name: null,
      reserved_unit_price_yen: null,
      reserved_duration_minutes: null,
      plans: {
        name: "1時間プラン",
        price_yen: 3000,
        duration_minutes: 60,
      },
    });

    expect(display.name).toBe("1時間プラン");
    expect(display.unitPriceYen).toBe(3000);
    expect(display.durationMinutes).toBe(60);
  });

  it("nameFallback を指定できる", () => {
    expect(
      getReservationPlanDisplay({}, { nameFallback: "プラン" }).name,
    ).toBe("プラン");
  });
});

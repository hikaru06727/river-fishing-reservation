import { describe, expect, it } from "vitest";
import { adminPlanFormSchema } from "./plan";

describe("adminPlanFormSchema", () => {
  const validBase = {
    name: "半日プラン",
    priceYen: 5000,
    durationMinutes: 180,
    maxGuests: 4,
    fishingSpotId: "11111111-1111-4111-8111-111111111111",
  };

  it("有効な入力を受け付ける", () => {
    const result = adminPlanFormSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("プラン名が空なら拒否する", () => {
    const result = adminPlanFormSchema.safeParse({ ...validBase, name: "  " });
    expect(result.success).toBe(false);
  });

  it("料金が負数なら拒否する", () => {
    const result = adminPlanFormSchema.safeParse({ ...validBase, priceYen: -1 });
    expect(result.success).toBe(false);
  });

  it("所要時間が0なら拒否する", () => {
    const result = adminPlanFormSchema.safeParse({ ...validBase, durationMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it("最大人数が0なら拒否する", () => {
    const result = adminPlanFormSchema.safeParse({ ...validBase, maxGuests: 0 });
    expect(result.success).toBe(false);
  });

  it("釣り場IDが未指定なら拒否する", () => {
    const result = adminPlanFormSchema.safeParse({ ...validBase, fishingSpotId: "" });
    expect(result.success).toBe(false);
  });
});

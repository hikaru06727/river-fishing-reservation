import { describe, expect, it } from "vitest";
import { resolveScopedSpotIdsForSales } from "@/lib/sales/sales-insights-context";

const bizA = "11111111-1111-4111-8111-111111111111";
const bizB = "22222222-2222-4222-8222-222222222222";

describe("resolveScopedSpotIdsForSales", () => {
  const spots = [
    { id: "spot-a", business_id: bizA },
    { id: "spot-b", business_id: bizB },
    { id: "spot-c", business_id: null },
  ];

  it("admin は全 manageable spot を対象にする", () => {
    expect(resolveScopedSpotIdsForSales(true, [], spots)).toEqual([
      "spot-a",
      "spot-b",
      "spot-c",
    ]);
  });

  it("business_admin は担当事業の spot のみを対象にする", () => {
    expect(resolveScopedSpotIdsForSales(false, [bizA], spots)).toEqual(["spot-a"]);
  });
});

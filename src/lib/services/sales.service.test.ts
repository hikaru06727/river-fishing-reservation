import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSalesDashboard } from "@/lib/services/sales.service";
import type { SalesReservationRow } from "@/lib/sales/sales-types";

const { getUserMock, getProfileMock, findAssignedBusinessIdsByUserIdMock, findSalesReservationRowsMock } =
  vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getProfileMock: vi.fn(),
    findAssignedBusinessIdsByUserIdMock: vi.fn(),
    findSalesReservationRowsMock: vi.fn(),
  }));

vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn(),
}));

vi.mock("@/lib/auth/get-user", () => ({
  getUser: getUserMock,
  getProfile: getProfileMock,
}));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: findAssignedBusinessIdsByUserIdMock,
}));

vi.mock("@/lib/repositories/sales.repository", () => ({
  findSalesReservationRows: findSalesReservationRowsMock,
}));

const bizA = "11111111-1111-4111-8111-111111111111";
const bizB = "22222222-2222-4222-8222-222222222222";

function sampleRow(
  overrides: Partial<SalesReservationRow> & Pick<SalesReservationRow, "id" | "reservation_date" | "status">,
): SalesReservationRow {
  return {
    payment_method: "online",
    guest_count: 2,
    total_amount_yen: 10000,
    reserved_plan_name: "半日プラン",
    reserved_unit_price_yen: 5000,
    business_id: bizA,
    business_name: "事業A",
    payments: { status: "succeeded", amount_yen: 10000 },
    ...overrides,
  };
}

describe("getSalesDashboard", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getProfileMock.mockReset();
    findAssignedBusinessIdsByUserIdMock.mockReset();
    findSalesReservationRowsMock.mockReset();
  });

  it("admin は全売上を取得できる", async () => {
    getUserMock.mockResolvedValue({ id: "admin-user" });
    getProfileMock.mockResolvedValue({ id: "admin-user", role: "admin" });
    findSalesReservationRowsMock.mockResolvedValue([
      sampleRow({ id: "a", reservation_date: "2026-06-22", status: "confirmed", business_id: bizA }),
      sampleRow({ id: "b", reservation_date: "2026-06-22", status: "confirmed", business_id: bizB, business_name: "事業B" }),
    ]);

    const result = await getSalesDashboard({ dateFrom: "2026-06-22", dateTo: "2026-06-22" });

    expect(result).not.toBeNull();
    expect(result?.isAdmin).toBe(true);
    expect(result?.report.projectedRevenueYen).toBe(20000);
    expect(findAssignedBusinessIdsByUserIdMock).not.toHaveBeenCalled();
  });

  it("business_admin は担当 business の売上だけ取得できる", async () => {
    getUserMock.mockResolvedValue({ id: "ba-user" });
    getProfileMock.mockResolvedValue({ id: "ba-user", role: "business_admin" });
    findAssignedBusinessIdsByUserIdMock.mockResolvedValue([bizA]);
    findSalesReservationRowsMock.mockResolvedValue([
      sampleRow({ id: "a", reservation_date: "2026-06-22", status: "confirmed", business_id: bizA }),
      sampleRow({ id: "b", reservation_date: "2026-06-22", status: "confirmed", business_id: bizB, business_name: "事業B" }),
    ]);

    const result = await getSalesDashboard({ dateFrom: "2026-06-22", dateTo: "2026-06-22" });

    expect(result).not.toBeNull();
    expect(result?.isAdmin).toBe(false);
    expect(result?.report.projectedRevenueYen).toBe(10000);
    expect(result?.scopedBusinessNames).toEqual(["事業A"]);
  });

  it("管理権限がない場合は null", async () => {
    getUserMock.mockResolvedValue({ id: "user" });
    getProfileMock.mockResolvedValue({ id: "user", role: "user" });

    const result = await getSalesDashboard();

    expect(result).toBeNull();
    expect(findSalesReservationRowsMock).not.toHaveBeenCalled();
  });

  it("期間未指定時は今日をデフォルトにする", async () => {
    getUserMock.mockResolvedValue({ id: "admin-user" });
    getProfileMock.mockResolvedValue({ id: "admin-user", role: "admin" });
    findSalesReservationRowsMock.mockResolvedValue([]);

    const result = await getSalesDashboard({});

    expect(result?.report.dateFrom).toBe(result?.report.dateTo);
    expect(findSalesReservationRowsMock).toHaveBeenCalledWith({
      dateFrom: result?.report.dateFrom,
      dateTo: result?.report.dateTo,
    });
  });
});

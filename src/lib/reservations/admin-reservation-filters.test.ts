import { describe, expect, it } from "vitest";
import {
  buildAdminReservationSearchParams,
  getWeekDateRange,
  parseAdminReservationFilters,
  parseReservationStatus,
  resolveReservationDateFilters,
} from "@/lib/reservations/admin-reservation-filters";

describe("parseReservationStatus", () => {
  it("有効な status をそのまま返す", () => {
    expect(parseReservationStatus("pending")).toBe("pending");
    expect(parseReservationStatus("confirmed")).toBe("confirmed");
    expect(parseReservationStatus("all")).toBe("all");
  });

  it("不正な値は all", () => {
    expect(parseReservationStatus("invalid")).toBe("all");
    expect(parseReservationStatus(undefined)).toBe("all");
  });
});

describe("parseAdminReservationFilters", () => {
  it("searchParams からフィルタを構築する", () => {
    expect(
      parseAdminReservationFilters({
        date: "2026-06-18",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-07",
        status: "confirmed",
        spotId: "spot-1",
        page: "2",
      }),
    ).toEqual({
      date: "2026-06-18",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-07",
      status: "confirmed",
      spotId: "spot-1",
      page: 2,
    });
  });

  it("page が不正なら 1", () => {
    expect(parseAdminReservationFilters({ page: "abc" }).page).toBe(1);
  });
});

describe("resolveReservationDateFilters", () => {
  it("単日 date が期間より優先される", () => {
    expect(
      resolveReservationDateFilters({
        date: "2026-06-18",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-07",
        status: "all",
        page: 1,
      }),
    ).toEqual({ singleDate: "2026-06-18" });
  });

  it("date がなければ期間フィルタ", () => {
    expect(
      resolveReservationDateFilters({
        dateFrom: "2026-06-01",
        dateTo: "2026-06-07",
        status: "all",
        page: 1,
      }),
    ).toEqual({ dateFrom: "2026-06-01", dateTo: "2026-06-07" });
  });
});

describe("buildAdminReservationSearchParams", () => {
  it("all status と page=1 は省略", () => {
    expect(
      buildAdminReservationSearchParams({
        status: "all",
        page: 1,
      }),
    ).toEqual({});
  });

  it("設定済みフィルタのみ含める", () => {
    expect(
      buildAdminReservationSearchParams({
        date: "2026-06-18",
        status: "pending",
        spotId: "spot-1",
        page: 3,
      }),
    ).toEqual({
      date: "2026-06-18",
      status: "pending",
      spotId: "spot-1",
      page: "3",
    });
  });
});

describe("getWeekDateRange", () => {
  it("基準日から7日間の範囲を返す", () => {
    const ref = new Date(2026, 5, 18);
    expect(getWeekDateRange(ref)).toEqual({
      dateFrom: "2026-06-18",
      dateTo: "2026-06-24",
    });
  });
});

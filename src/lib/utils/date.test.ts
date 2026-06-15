import { describe, expect, it } from "vitest";
import {
  getReservationStartAtJst,
  getUserCancelDeadline,
  isBeforeUserCancelDeadline,
} from "./date";

describe("getReservationStartAtJst", () => {
  it("reservation_date + HH:MM から JST の Date を作れる", () => {
    const result = getReservationStartAtJst("2026-06-15", "09:00");
    expect(result.toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });

  it("start_time が HH:MM:SS でも同じ Date になる", () => {
    const hhmm = getReservationStartAtJst("2026-06-15", "09:00");
    const hhmmss = getReservationStartAtJst("2026-06-15", "09:00:00");
    expect(hhmm.getTime()).toBe(hhmmss.getTime());
  });
});

describe("isBeforeUserCancelDeadline", () => {
  const startAt = getReservationStartAtJst("2026-06-20", "09:00");

  it("利用開始25時間前はキャンセル期限内", () => {
    const now = new Date(startAt.getTime() - 25 * 60 * 60 * 1000);
    expect(isBeforeUserCancelDeadline(startAt, now)).toBe(true);
  });

  it("利用開始24時間前（境界）はキャンセル期限外", () => {
    const deadline = getUserCancelDeadline(startAt);
    expect(isBeforeUserCancelDeadline(startAt, deadline)).toBe(false);
  });

  it("利用開始23時間前はキャンセル期限外", () => {
    const now = new Date(startAt.getTime() - 23 * 60 * 60 * 1000);
    expect(isBeforeUserCancelDeadline(startAt, now)).toBe(false);
  });
});

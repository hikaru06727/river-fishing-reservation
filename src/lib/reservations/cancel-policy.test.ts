import { describe, expect, it } from "vitest";
import { canCancelReservation } from "./cancel-policy";

const RESERVATION_DATE = "2026-06-20";
const START_TIME = "09:00";

function hoursBeforeStart(hours: number): Date {
  const startAt = new Date(`${RESERVATION_DATE}T${START_TIME}:00+09:00`);
  return new Date(startAt.getTime() - hours * 60 * 60 * 1000);
}

describe("canCancelReservation", () => {
  it("confirmed かつ25時間前ならキャンセル可", () => {
    const result = canCancelReservation({
      status: "confirmed",
      reservationDate: RESERVATION_DATE,
      startTime: START_TIME,
      now: hoursBeforeStart(25),
    });
    expect(result).toEqual({ allowed: true });
  });

  it("confirmed かつ23時間前ならキャンセル不可", () => {
    const result = canCancelReservation({
      status: "confirmed",
      reservationDate: RESERVATION_DATE,
      startTime: START_TIME,
      now: hoursBeforeStart(23),
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      "利用開始24時間前を過ぎているため、キャンセルできません。",
    );
  });

  it("pending は一般ユーザー不可", () => {
    const result = canCancelReservation({
      status: "pending",
      reservationDate: RESERVATION_DATE,
      startTime: START_TIME,
      now: hoursBeforeStart(48),
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("この予約はキャンセルできません。");
  });

  it("pending は管理者可", () => {
    const result = canCancelReservation({
      status: "pending",
      reservationDate: RESERVATION_DATE,
      startTime: START_TIME,
      isAdmin: true,
      now: hoursBeforeStart(1),
    });
    expect(result).toEqual({ allowed: true });
  });

  it("cancelled は不可", () => {
    const result = canCancelReservation({
      status: "cancelled",
      reservationDate: RESERVATION_DATE,
      startTime: START_TIME,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("この予約はキャンセルできません。");
  });

  it("expired は不可", () => {
    const result = canCancelReservation({
      status: "expired",
      reservationDate: RESERVATION_DATE,
      startTime: START_TIME,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("この予約はキャンセルできません。");
  });

  it("now >= startAt - 24h の境界では不可", () => {
    const startAt = new Date(`${RESERVATION_DATE}T${START_TIME}:00+09:00`);
    const atDeadline = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);

    const result = canCancelReservation({
      status: "confirmed",
      reservationDate: RESERVATION_DATE,
      startTime: START_TIME,
      now: atDeadline,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(
      "利用開始24時間前を過ぎているため、キャンセルできません。",
    );
  });
});

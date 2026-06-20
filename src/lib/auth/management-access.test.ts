import { describe, expect, it } from "vitest";
import {
  canManageBusinessForProfile,
  canManagePlanForProfile,
  canManageReservationForProfile,
  canManageSpotForProfile,
} from "./management-access";
import type { Profile } from "@/types/database";

function profile(role: Profile["role"]): Pick<Profile, "role" | "id"> {
  return { id: "user-1", role };
}

describe("canManageBusinessForProfile", () => {
  const bizA = "biz-a";
  const assigned = [bizA];

  it("admin は全 business OK", () => {
    expect(canManageBusinessForProfile(profile("admin"), "any-id", [])).toBe(true);
  });

  it("business_admin は割当事業のみ OK", () => {
    expect(canManageBusinessForProfile(profile("business_admin"), bizA, assigned)).toBe(
      true,
    );
    expect(canManageBusinessForProfile(profile("business_admin"), "other", assigned)).toBe(
      false,
    );
  });

  it("user は不可", () => {
    expect(canManageBusinessForProfile(profile("user"), bizA, assigned)).toBe(false);
  });
});

describe("canManageSpotForProfile", () => {
  const bizA = "biz-a";

  it("business_admin は spot の business_id が割当内なら OK", () => {
    expect(
      canManageSpotForProfile(profile("business_admin"), bizA, [bizA]),
    ).toBe(true);
    expect(
      canManageSpotForProfile(profile("business_admin"), "other-biz", [bizA]),
    ).toBe(false);
  });

  it("business_id が null なら不可", () => {
    expect(canManageSpotForProfile(profile("business_admin"), null, [bizA])).toBe(false);
  });
});

describe("canManageReservationForProfile", () => {
  const bizA = "biz-a";

  it("admin は全予約を操作可能", () => {
    expect(canManageReservationForProfile(profile("admin"), bizA, [])).toBe(true);
    expect(canManageReservationForProfile(profile("admin"), "other", [])).toBe(true);
  });

  it("business_admin は担当事業の予約のみ操作可能", () => {
    expect(
      canManageReservationForProfile(profile("business_admin"), bizA, [bizA]),
    ).toBe(true);
    expect(
      canManageReservationForProfile(profile("business_admin"), "other-biz", [bizA]),
    ).toBe(false);
  });

  it("担当外 reservation（spot business 不一致）は拒否", () => {
    expect(
      canManageReservationForProfile(profile("business_admin"), null, [bizA]),
    ).toBe(false);
  });
});

describe("canManagePlanForProfile", () => {
  const bizA = "biz-a";
  const spotA = "spot-a";
  const assigned = [bizA];

  it("admin は共通プラン（spot なし）も操作可能", () => {
    expect(canManagePlanForProfile(profile("admin"), null, null, [])).toBe(true);
  });

  it("admin は全 spot のプランを操作可能", () => {
    expect(canManagePlanForProfile(profile("admin"), spotA, bizA, [])).toBe(true);
  });

  it("business_admin は共通プランを操作不可", () => {
    expect(canManagePlanForProfile(profile("business_admin"), null, null, assigned)).toBe(
      false,
    );
  });

  it("business_admin は担当事業の spot プランのみ操作可能", () => {
    expect(
      canManagePlanForProfile(profile("business_admin"), spotA, bizA, assigned),
    ).toBe(true);
    expect(
      canManagePlanForProfile(profile("business_admin"), spotA, "other-biz", assigned),
    ).toBe(false);
  });

  it("一般 user はプラン操作不可", () => {
    expect(canManagePlanForProfile(profile("user"), spotA, bizA, [])).toBe(false);
  });
});

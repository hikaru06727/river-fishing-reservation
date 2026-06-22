import { describe, expect, it } from "vitest";
import {
  dateExceptionFormSchema,
  dateExceptionTagTypeSchema,
  parseDateExceptionForm,
} from "./business-hours";

const spotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeFormData(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("dateExceptionTagTypeSchema", () => {
  it("有効な tagType を受け付ける", () => {
    const result = dateExceptionTagTypeSchema.safeParse("temporary_closed");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("temporary_closed");
    }
  });

  it("空文字は null として扱う", () => {
    const result = dateExceptionTagTypeSchema.safeParse("");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it("不正な tagType を拒否する", () => {
    const result = dateExceptionTagTypeSchema.safeParse("invalid_tag");
    expect(result.success).toBe(false);
  });
});

describe("dateExceptionFormSchema tagType", () => {
  it("tagType 未指定でも既存挙動が壊れない", () => {
    const result = dateExceptionFormSchema.safeParse({
      fishingSpotId: spotId,
      exceptionDate: "2026-06-24",
      isOpen: false,
      is24Hours: false,
      openTime: null,
      closeTime: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tagType).toBeUndefined();
    }
  });

  it("event タグ付き例外日を受け付ける", () => {
    const result = dateExceptionFormSchema.safeParse({
      fishingSpotId: spotId,
      exceptionDate: "2026-06-24",
      isOpen: true,
      is24Hours: false,
      openTime: "09:00",
      closeTime: "17:00",
      tagType: "event",
      note: "釣り大会",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tagType).toBe("event");
    }
  });
});

describe("parseDateExceptionForm tagType", () => {
  it("フォームの空文字 tagType を null に正規化する", () => {
    const parsed = parseDateExceptionForm(
      makeFormData({
        fishingSpotId: spotId,
        exceptionDate: "2026-06-24",
        tagType: "",
        openTime: "09:00",
        closeTime: "17:00",
      }),
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tagType).toBeNull();
    }
  });
});

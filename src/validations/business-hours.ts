import { z } from "zod";
import { DATE_EXCEPTION_TAG_TYPES } from "@/lib/business-hours/date-exception-tags";

const uuidSchema = z.string().uuid("釣り場IDが不正です");

const timeSchema = z
  .string()
  .trim()
  .regex(/^\d{1,2}:\d{2}$/, "時刻は HH:MM 形式で入力してください");

const weeklyDaySchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    isOpen: z.boolean(),
    is24Hours: z.boolean(),
    openTime: z.string().nullable(),
    closeTime: z.string().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.isOpen) {
      return;
    }
    if (data.is24Hours) {
      return;
    }
    if (!data.openTime || !data.closeTime) {
      ctx.addIssue({
        code: "custom",
        message: "営業日は開店・閉店時刻を入力してください",
        path: ["openTime"],
      });
      return;
    }
    const open = timeSchema.safeParse(data.openTime);
    const close = timeSchema.safeParse(data.closeTime);
    if (!open.success || !close.success) {
      ctx.addIssue({
        code: "custom",
        message: "時刻は HH:MM 形式で入力してください",
        path: ["openTime"],
      });
      return;
    }
    const [oh, om] = open.data.split(":").map(Number);
    const [ch, cm] = close.data.split(":").map(Number);
    const openMinutes = oh! * 60 + om!;
    const closeMinutes = ch! * 60 + cm!;
    if (openMinutes >= closeMinutes) {
      ctx.addIssue({
        code: "custom",
        message: "閉店時刻は開店時刻より後にしてください",
        path: ["closeTime"],
      });
    }
  });

export const weeklyHoursFormSchema = z.object({
  fishingSpotId: uuidSchema,
  days: z.array(weeklyDaySchema).length(7),
});

export type WeeklyHoursFormInput = z.infer<typeof weeklyHoursFormSchema>;

export const dateExceptionTagTypeSchema = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.enum(DATE_EXCEPTION_TAG_TYPES).nullable(),
);

export const dateExceptionFormSchema = z
  .object({
    fishingSpotId: uuidSchema,
    exceptionId: uuidSchema.optional(),
    exceptionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が不正です"),
    isOpen: z.boolean(),
    is24Hours: z.boolean(),
    ignoreWeeklyBreaks: z.boolean().optional(),
    openTime: z.string().nullable(),
    closeTime: z.string().nullable(),
    tagType: dateExceptionTagTypeSchema.optional(),
    note: z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? null : value))
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isOpen) {
      return;
    }
    if (data.is24Hours) {
      return;
    }
    if (!data.openTime || !data.closeTime) {
      ctx.addIssue({
        code: "custom",
        message: "営業日は開店・閉店時刻を入力してください",
        path: ["openTime"],
      });
    }
  });

export type DateExceptionFormInput = z.infer<typeof dateExceptionFormSchema>;

function parseBooleanField(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function parseNullableTime(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

export function parseWeeklyHoursForm(formData: FormData) {
  const fishingSpotId = formData.get("fishingSpotId");
  const days = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: parseBooleanField(formData.get(`day_${dayOfWeek}_isOpen`)),
    is24Hours: parseBooleanField(formData.get(`day_${dayOfWeek}_is24Hours`)),
    openTime: parseNullableTime(formData.get(`day_${dayOfWeek}_openTime`)),
    closeTime: parseNullableTime(formData.get(`day_${dayOfWeek}_closeTime`)),
  }));

  return weeklyHoursFormSchema.safeParse({ fishingSpotId, days });
}

export function parseDateExceptionForm(formData: FormData) {
  const exceptionIdRaw = formData.get("exceptionId");
  const exceptionId =
    typeof exceptionIdRaw === "string" && exceptionIdRaw.length > 0
      ? exceptionIdRaw
      : undefined;

  return dateExceptionFormSchema.safeParse({
    fishingSpotId: formData.get("fishingSpotId"),
    exceptionId,
    exceptionDate: formData.get("exceptionDate"),
    isOpen: parseBooleanField(formData.get("isOpen")),
    is24Hours: parseBooleanField(formData.get("is24Hours")),
    ignoreWeeklyBreaks: parseBooleanField(formData.get("ignoreWeeklyBreaks")),
    openTime: parseNullableTime(formData.get("openTime")),
    closeTime: parseNullableTime(formData.get("closeTime")),
    tagType: formData.get("tagType"),
    note: formData.get("note") ?? undefined,
  });
}

export const deleteDateExceptionSchema = z.object({
  fishingSpotId: uuidSchema,
  exceptionId: uuidSchema,
});

export function parseDeleteDateExceptionForm(formData: FormData) {
  return deleteDateExceptionSchema.safeParse({
    fishingSpotId: formData.get("fishingSpotId"),
    exceptionId: formData.get("exceptionId"),
  });
}

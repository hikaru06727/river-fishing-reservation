import { z } from "zod";

const uuidSchema = z.string().uuid("釣り場IDが不正です");
const exceptionIdSchema = z.string().uuid("例外日IDが不正です");

const timeSchema = z
  .string()
  .trim()
  .regex(/^\d{1,2}:\d{2}$/, "時刻は HH:MM 形式で入力してください");

const breakRowSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
    startTime: timeSchema,
    endTime: timeSchema,
    label: z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? null : value))
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const [sh, sm] = data.startTime.split(":").map(Number);
    const [eh, em] = data.endTime.split(":").map(Number);
    const startMinutes = sh! * 60 + sm!;
    const endMinutes = eh! * 60 + em!;
    if (startMinutes >= endMinutes) {
      ctx.addIssue({
        code: "custom",
        message: "終了時刻は開始時刻より後にしてください",
        path: ["endTime"],
      });
    }
  });

const weeklyBreakRowSchema = breakRowSchema.safeExtend({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
});

export const weeklyBreaksFormSchema = z.object({
  fishingSpotId: uuidSchema,
  breaks: z.array(weeklyBreakRowSchema),
});

export type WeeklyBreaksFormInput = z.infer<typeof weeklyBreaksFormSchema>;

export const exceptionBreaksFormSchema = z.object({
  fishingSpotId: uuidSchema,
  exceptionId: exceptionIdSchema,
  ignoreWeeklyBreaks: z.boolean(),
  breaks: z.array(breakRowSchema),
});

export type ExceptionBreaksFormInput = z.infer<typeof exceptionBreaksFormSchema>;

function parseBooleanField(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function parseNullableLabel(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function parseBreakRowsFromFormData(
  formData: FormData,
  prefix: string,
): z.infer<typeof breakRowSchema>[] {
  const countRaw = formData.get(`${prefix}Count`);
  const count = Number(countRaw ?? "0");
  if (!Number.isInteger(count) || count < 0) {
    return [];
  }

  const rows: z.infer<typeof breakRowSchema>[] = [];
  for (let i = 0; i < count; i++) {
    const startTime = formData.get(`${prefix}_${i}_startTime`);
    const endTime = formData.get(`${prefix}_${i}_endTime`);
    if (typeof startTime !== "string" || typeof endTime !== "string") {
      continue;
    }
    const dayOfWeekRaw = formData.get(`${prefix}_${i}_dayOfWeek`);
    rows.push({
      dayOfWeek:
        dayOfWeekRaw != null ? Number(dayOfWeekRaw) : undefined,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      label: parseNullableLabel(formData.get(`${prefix}_${i}_label`)),
    });
  }
  return rows;
}

export function parseWeeklyBreaksForm(formData: FormData) {
  const breaks = parseBreakRowsFromFormData(formData, "weeklyBreak").map((row) => ({
    dayOfWeek: row.dayOfWeek!,
    startTime: row.startTime,
    endTime: row.endTime,
    label: row.label ?? null,
  }));

  return weeklyBreaksFormSchema.safeParse({
    fishingSpotId: formData.get("fishingSpotId"),
    breaks,
  });
}

export function parseExceptionBreaksForm(formData: FormData) {
  const breaks = parseBreakRowsFromFormData(formData, "exceptionBreak").map((row) => ({
    startTime: row.startTime,
    endTime: row.endTime,
    label: row.label ?? null,
  }));

  return exceptionBreaksFormSchema.safeParse({
    fishingSpotId: formData.get("fishingSpotId"),
    exceptionId: formData.get("exceptionId"),
    ignoreWeeklyBreaks: parseBooleanField(formData.get("ignoreWeeklyBreaks")),
    breaks,
  });
}

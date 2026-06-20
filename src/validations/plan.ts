import { z } from "zod";

const uuidSchema = z.string().uuid("対象釣り場を選択してください");

export const adminPlanFormSchema = z.object({
  name: z.string().trim().min(1, "プラン名は必須です"),
  description: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional(),
  priceYen: z.coerce
    .number({ error: "料金は数値で入力してください" })
    .int("料金は整数で入力してください")
    .min(0, "料金は0円以上で入力してください"),
  durationMinutes: z.coerce
    .number({ error: "所要時間は数値で入力してください" })
    .int("所要時間は整数で入力してください")
    .min(1, "所要時間は1分以上で入力してください"),
  maxGuests: z.coerce
    .number({ error: "最大人数は数値で入力してください" })
    .int("最大人数は整数で入力してください")
    .min(1, "最大人数は1名以上で入力してください"),
  fishingSpotId: uuidSchema,
  isVisible: z.boolean().optional().default(true),
  isAcceptingReservations: z.boolean().optional().default(true),
});

export type AdminPlanFormInput = z.infer<typeof adminPlanFormSchema>;

export const adminPlanToggleSchema = z.object({
  planId: uuidSchema,
});

export function parseAdminPlanForm(formData: FormData, options?: { allowLegacyGlobal?: boolean }) {
  const isLegacyGlobal = options?.allowLegacyGlobal === true;

  const fishingSpotIdRaw = formData.get("fishingSpotId");
  const fishingSpotId =
    typeof fishingSpotIdRaw === "string" && fishingSpotIdRaw.length > 0
      ? fishingSpotIdRaw
      : isLegacyGlobal
        ? "00000000-0000-4000-8000-000000000000"
        : fishingSpotIdRaw;

  return adminPlanFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    priceYen: formData.get("priceYen"),
    durationMinutes: formData.get("durationMinutes"),
    maxGuests: formData.get("maxGuests"),
    fishingSpotId,
    isVisible: formData.get("isVisible") === "on" || formData.get("isVisible") === "true",
    isAcceptingReservations:
      formData.get("isAcceptingReservations") === "on" ||
      formData.get("isAcceptingReservations") === "true",
  });
}

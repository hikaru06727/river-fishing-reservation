import { z } from "zod";

export const manualSaleFormSchema = z.object({
  businessId: z.string().uuid("事業を選択してください"),
  locationId: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().uuid("釣り場の形式が正しくありません").nullable().optional(),
  ),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "売上日の形式が正しくありません"),
  amountYen: z.coerce
    .number({ error: "金額は数値で入力してください" })
    .int("金額は整数で入力してください")
    .min(0, "金額は0以上で入力してください"),
  taxRatePercent: z.coerce
    .number({ error: "税率は数値で入力してください" })
    .int("税率は整数で入力してください")
    .min(0, "税率は0以上で入力してください")
    .max(100, "税率は100以下で入力してください"),
  category: z.enum(["bait", "rental", "parking", "food", "event", "other"], {
    error: "カテゴリを選択してください",
  }),
  paymentMethod: z.enum(["cash", "card", "qr", "other"], {
    error: "支払方法を選択してください",
  }),
  description: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().nullable().optional(),
  ),
});

export type ManualSaleFormInput = z.infer<typeof manualSaleFormSchema>;

export function parseManualSaleForm(formData: FormData) {
  return manualSaleFormSchema.safeParse({
    businessId: formData.get("businessId"),
    locationId: formData.get("locationId"),
    saleDate: formData.get("saleDate"),
    amountYen: formData.get("amountYen"),
    taxRatePercent: formData.get("taxRatePercent"),
    category: formData.get("category"),
    paymentMethod: formData.get("paymentMethod"),
    description: formData.get("description"),
  });
}

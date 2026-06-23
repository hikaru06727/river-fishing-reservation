import { z } from "zod";

const cartItemDiscountSchema = z.object({
  type: z.enum(["amount", "rate"]),
  value: z.coerce.number().min(0),
});

const cartItemSchema = z.object({
  product_id: z.string().uuid("商品IDが不正です"),
  quantity: z.coerce
    .number({ error: "数量は数値で入力してください" })
    .int("数量は整数で入力してください")
    .min(1, "数量は1以上で入力してください"),
  tax_rate: z.coerce.number().min(0).max(100).optional(),
  item_discount: cartItemDiscountSchema.nullable().optional(),
});

const sessionDiscountSchema = z.object({
  type: z.enum(["amount", "rate"]),
  value: z.coerce.number().min(0),
});

export const POS_PAYMENT_METHODS = [
  { value: "cash", label: "現金" },
  { value: "credit_card", label: "クレジットカード" },
  { value: "e_money", label: "電子マネー" },
  { value: "qr", label: "QRコード決済" },
  { value: "other", label: "その他" },
] as const;

export type PosPaymentMethodValue = (typeof POS_PAYMENT_METHODS)[number]["value"];

export const posFormSchema = z.object({
  businessId: z.string().uuid("事業を選択してください"),
  items: z.preprocess(
    (val) => {
      if (typeof val !== "string") return [];
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    },
    z.array(cartItemSchema).min(1, "商品を選択してください"),
  ),
  sessionDiscount: z.preprocess(
    (val) => {
      if (typeof val !== "string" || val === "" || val === "null") return null;
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    },
    sessionDiscountSchema.nullable().optional(),
  ),
  paymentMethod: z.enum(
    ["cash", "credit_card", "e_money", "qr", "other", "stripe"],
    { error: "支払方法を選択してください" },
  ),
  paymentOtherLabel: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().max(100).nullable().optional(),
  ),
  note: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().max(500, "備考は500文字以内で入力してください").nullable().optional(),
  ),
});

export type PosFormInput = z.infer<typeof posFormSchema>;

export function parsePosForm(formData: FormData) {
  return posFormSchema.safeParse({
    businessId: formData.get("businessId"),
    items: formData.get("items"),
    sessionDiscount: formData.get("sessionDiscount"),
    paymentMethod: formData.get("paymentMethod"),
    paymentOtherLabel: formData.get("paymentOtherLabel"),
    note: formData.get("note"),
  });
}

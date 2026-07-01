import { z } from "zod";

const checkboxBoolean = z.preprocess(
  (val) => val === "on" || val === "true" || val === true,
  z.boolean(),
);

export const productFormSchema = z.object({
  businessId: z.string().uuid("事業を選択してください"),
  name: z.string().min(1, "商品名を入力してください").max(100, "商品名は100文字以内で入力してください"),
  description: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().max(1000, "説明は1000文字以内で入力してください").nullable().optional(),
  ),
  priceExcludingTax: z.coerce
    .number({ error: "価格は数値で入力してください" })
    .int("価格は整数で入力してください")
    .min(0, "価格は0以上で入力してください"),
  stockQuantity: z.preprocess(
    (val) => (val === "" || val === null ? null : val),
    z.coerce
      .number({ error: "在庫数は数値で入力してください" })
      .int("在庫数は整数で入力してください")
      .min(0, "在庫数は0以上で入力してください")
      .nullable()
      .optional(),
  ),
  imageUrl: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().url("URLの形式が正しくありません").nullable().optional(),
  ),
  status: z.enum(["on_sale", "off_sale", "archived"], {
    error: "ステータスを選択してください",
  }),
  defaultTaxRate: z.coerce
    .number({ error: "税率は数値で入力してください" })
    .refine((v) => v === 10 || v === 8, "税率は 10% または 8% を選択してください"),
  category: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().max(50, "カテゴリは50文字以内で入力してください").nullable().optional(),
  ),
  isPublishedOnline: checkboxBoolean,
  trackInventory: checkboxBoolean,
  shippable: checkboxBoolean,
  descriptionOnline: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().max(2000, "オンライン説明文は2000文字以内で入力してください").nullable().optional(),
  ),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;

export function parseProductForm(formData: FormData) {
  return productFormSchema.safeParse({
    businessId: formData.get("businessId"),
    name: formData.get("name"),
    description: formData.get("description"),
    priceExcludingTax: formData.get("priceExcludingTax"),
    stockQuantity: formData.get("stockQuantity"),
    imageUrl: formData.get("imageUrl"),
    status: formData.get("status"),
    defaultTaxRate: formData.get("defaultTaxRate") ?? "10",
    category: formData.get("category"),
    isPublishedOnline: formData.get("isPublishedOnline"),
    trackInventory: formData.get("trackInventory"),
    shippable: formData.get("shippable"),
    descriptionOnline: formData.get("descriptionOnline"),
  });
}

export const productSaleFormSchema = z.object({
  businessId: z.string().uuid("事業を選択してください"),
  productId: z.string().uuid("商品を選択してください"),
  quantity: z.coerce
    .number({ error: "数量は数値で入力してください" })
    .int("数量は整数で入力してください")
    .min(1, "数量は1以上で入力してください"),
  paymentMethod: z.enum(["cash", "stripe"], {
    error: "支払方法を選択してください",
  }),
  purchasedAt: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().nullable().optional(),
  ),
});

export type ProductSaleFormInput = z.infer<typeof productSaleFormSchema>;

export function parseProductSaleForm(formData: FormData) {
  return productSaleFormSchema.safeParse({
    businessId: formData.get("businessId"),
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    paymentMethod: formData.get("paymentMethod"),
    purchasedAt: formData.get("purchasedAt"),
  });
}

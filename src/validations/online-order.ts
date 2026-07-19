import { z } from "zod";
import { isPickupDateWithinWindow, isValidPickupTimeSlot } from "@/lib/online-orders/pickup-schedule";

export const createOnlineOrderSchema = z
  .object({
    slug: z.string().min(1, "店舗が不正です"),
    businessId: z.string().uuid("店舗IDが不正です"),
    items: z
      .array(
        z.object({
          productId: z.string().uuid("商品IDが不正です"),
          quantity: z.coerce.number().int().min(1, "数量は1以上で入力してください"),
        }),
      )
      .min(1, "カートが空です"),
    fulfillmentType: z.enum(["shipping", "pickup"], { error: "受け取り方法を選択してください" }),
    customerName: z.string().min(1, "氏名を入力してください").max(100),
    customerEmail: z.string().email("メールアドレスの形式が正しくありません"),
    customerPhone: z.string().max(20).optional(),
    shippingAddress: z
      .object({
        postalCode: z.string().min(1, "郵便番号を入力してください").max(10),
        prefecture: z.string().min(1, "都道府県を入力してください").max(20),
        addressLine1: z.string().min(1, "住所を入力してください").max(200),
        addressLine2: z.string().max(200).optional(),
      })
      .optional(),
    pickupDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "受け取り希望日の形式が正しくありません")
      .optional(),
    pickupTime: z.string().optional(),
    linkedReservationId: z.string().uuid().optional(),
    /** ログイン済みの場合に「この住所を今後のために保存する」を選択したか（Phase 20） */
    saveAddress: z.boolean().optional(),
  })
  .refine((data) => data.fulfillmentType !== "shipping" || data.shippingAddress !== undefined, {
    message: "配送先住所を入力してください",
    path: ["shippingAddress"],
  })
  .refine((data) => data.fulfillmentType !== "pickup" || !!data.pickupDate, {
    message: "受け取り希望日を選択してください",
    path: ["pickupDate"],
  })
  .refine((data) => data.fulfillmentType !== "pickup" || !!data.pickupTime, {
    message: "受け取り希望時刻を選択してください",
    path: ["pickupTime"],
  })
  .refine(
    (data) =>
      data.fulfillmentType !== "pickup" ||
      !data.pickupDate ||
      isPickupDateWithinWindow(data.pickupDate),
    {
      message: "受け取り希望日は翌日から30日以内で選択してください",
      path: ["pickupDate"],
    },
  )
  .refine(
    (data) =>
      data.fulfillmentType !== "pickup" ||
      !data.pickupTime ||
      isValidPickupTimeSlot(data.pickupTime),
    {
      message: "受け取り希望時刻は09:00〜18:00の30分刻みで選択してください",
      path: ["pickupTime"],
    },
  );

export type CreateOnlineOrderInput = z.infer<typeof createOnlineOrderSchema>;

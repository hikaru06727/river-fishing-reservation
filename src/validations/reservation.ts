import { z } from "zod";

const ALLOWED_TIMES_1H = ["9:00", "10:00", "11:00", "13:00", "14:00", "15:00"];
const ALLOWED_TIMES_3H = ["9:00", "13:00"];

/** バリデーション用に "09:00" → "9:00" 形式へ正規化 */
export function normalizeTimeInput(time: string): string {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return time;
  }
  return `${parseInt(match[1]!, 10)}:${match[2]}`;
}

/** プラン slug（1h / 3h）に対する開始時刻の可否 */
export function isAllowedStartTime(planSlug: string, startTime: string): boolean {
  const normalized = normalizeTimeInput(startTime);
  const allowed = planSlug === "3h" ? ALLOWED_TIMES_3H : ALLOWED_TIMES_1H;
  return allowed.includes(normalized);
}

function isTodayOrFuture(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return target >= today;
}

export const createReservationSchema = z
  .object({
    spotId: z.string().uuid("釣り場IDが不正です"),
    planId: z.string().uuid("プランIDが不正です"),
    slotId: z.string().uuid("空き枠IDが不正です"),
    reservationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "利用日の形式が不正です"),
    guestCount: z.coerce
      .number()
      .int("参加人数は整数で入力してください")
      .min(1, "参加人数は1名以上です")
      .max(20, "参加人数は20名以下です"),
  })
  .refine((data) => isTodayOrFuture(data.reservationDate), {
    message: "過去の日付は選択できません",
    path: ["reservationDate"],
  });

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const cancelReservationSchema = z.object({
  reservationId: z.string().uuid("予約IDが不正です"),
});

export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;

/** プラン slug + 日付 + 時間（レガシー／API 補助用） */
export const reservationSchema = z
  .object({
    planId: z.enum(["1h", "3h"]),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が正しくありません")
      .refine(isTodayOrFuture, { message: "過去の日付は選択できません" }),
    time: z.string(),
  })
  .refine(
    ({ planId, time }) => isAllowedStartTime(planId, time),
    { message: "選択できない時間帯です", path: ["time"] },
  );

export type ReservationInput = z.infer<typeof reservationSchema>;

export const checkoutSchema = z.object({
  reservation_id: z.string().uuid("予約IDが不正です"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const blogPostSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "スラッグは半角英数字とハイフンのみ"),
  excerpt: z.string().optional(),
  content: z.string().min(1, "本文を入力してください"),
  published: z.boolean(),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;

export const catchSchema = z.object({
  spotId: z.string().uuid("釣り場を選択してください"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が正しくありません"),
  species: z.string().min(1, "魚種を入力してください"),
  size: z.string().optional(),
  excerpt: z.string().optional(),
  body: z.string().min(1, "詳細を入力してください"),
});

export type CatchInput = z.infer<typeof catchSchema>;

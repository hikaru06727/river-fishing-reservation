/**
 * アプリドメイン型 — DB / Supabase 実装に依存しない。
 * UI・Service・Auth 層はこちらを参照し、Repository 層のみ database.ts の Row 型を使う。
 */

export type UserRole = "user" | "admin" | "business_admin";
/** @deprecated UserRole と同一。後方互換用 */
export type AppUserRole = UserRole;

export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "expired";
export type PaymentMethod = "online" | "cash_at_venue";
export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "expired"
  | "disputed";
export type ContentStatus = "draft" | "published";
export type SlotStatus = "open" | "closed";

/** 認証済みユーザーのアプリ内表現（Supabase User 型に非依存） */
export type AuthUser = {
  id: string;
  email: string | null;
};

/** profiles テーブルのドメイン表現 */
export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

/** UI / API で使うプラン概要 */
export type PlanSummary = {
  id: string;
  name: string;
  slug: string;
  duration_minutes: number;
  price_yen: number;
};

/** 予約のドメイン概要（JOIN 結果を含む場合は各 getter で拡張） */
export type ReservationSummary = {
  id: string;
  user_id: string;
  spot_id: string;
  plan_id: string;
  status: ReservationStatus;
  payment_method: PaymentMethod;
  guest_count: number;
  total_amount_yen: number;
  reservation_date: string;
  start_time: string;
  end_time: string;
  expires_at: string | null;
};

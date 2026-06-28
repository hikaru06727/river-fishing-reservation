/**
 * アプリドメイン型 — DB / Supabase 実装に依存しない。
 * UI・Service・Auth 層はこちらを参照し、Repository 層のみ database.ts の Row 型を使う。
 */

export type UserRole = "user" | "admin" | "business_admin" | "staff";
/** @deprecated UserRole と同一。後方互換用 */
export type AppUserRole = UserRole;

export type StaffStatus = "invited" | "active" | "disabled";

export type RegisterClosingStatus = "closed" | "correction_requested" | "approved";
export type ClosingCorrectionStatus = "pending" | "approved" | "rejected";

export type SaleRefundStatus = "pending" | "completed" | "failed";
export type SaleRefundPaymentMethod = "cash" | "card" | "other";

export type PaymentLedgerSourceType = "pos" | "reservation" | "manual" | "booth";

export type BoothStatus = "active" | "inactive";
export type BoothTaxCategory = "standard" | "reduced";
export type BoothSlotStatus = "open" | "closed" | "full";
export type BoothBookingPaymentStatus = "pending" | "paid" | "refunded";
export type BoothBookingSource = "pos" | "online";

export type Booth = {
  id: string;
  business_id: string;
  location_id: string | null;
  name: string;
  description: string | null;
  capacity: number;
  price: number;
  tax_category: BoothTaxCategory;
  status: BoothStatus;
  created_at: string;
  updated_at: string;
};

export type BoothSlot = {
  id: string;
  business_id: string;
  booth_id: string;
  date: string;
  start_time: string;
  end_time: string;
  max_bookings: number;
  status: BoothSlotStatus;
  created_at: string;
  updated_at: string;
};

export type BoothBooking = {
  id: string;
  business_id: string;
  booth_slot_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total_amount: number;
  payment_status: BoothBookingPaymentStatus;
  source: BoothBookingSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
export type PaymentLedgerPaymentMethod = "cash" | "card" | "other";
export type PaymentLedgerStatus =
  | "pending"
  | "succeeded"
  | "refunded"
  | "partially_refunded"
  | "cancelled";

export type StaffMember = {
  id: string;
  business_id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  role: string;
  status: StaffStatus;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
};

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
export type ProductStatus = "on_sale" | "off_sale" | "archived";
export type ProductSaleStatus = "pending" | "completed" | "refunded";

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

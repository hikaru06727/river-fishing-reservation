import type {
  OnlineOrderFulfillmentType,
  OnlineOrderPaymentMethod,
  OnlineOrderPaymentStatus,
  OnlineOrderStatus,
} from "@/types/domain";

export type OnlineOrder = {
  id: string;
  business_id: string;
  user_id: string | null;
  status: OnlineOrderStatus;
  fulfillment_type: OnlineOrderFulfillmentType;
  payment_method: OnlineOrderPaymentMethod;
  payment_status: OnlineOrderPaymentStatus;
  stripe_checkout_session_id: string | null;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_postal_code: string | null;
  shipping_prefecture: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  notes: string | null;
  pickup_date: string | null;
  pickup_deadline: string | null;
  confirmation_code: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  /** 予約後の追加購入の場合に紐づく予約ID（Phase 19E）。決済・返金・売上集計は予約から独立。 */
  linked_reservation_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OnlineOrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  tax_rate: number;
  quantity: number;
  created_at: string;
};

export type CreateOrderInput = {
  businessId: string;
  slug: string;
  items: { productId: string; quantity: number }[];
  fulfillmentType: OnlineOrderFulfillmentType;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: {
    postalCode: string;
    prefecture: string;
    addressLine1: string;
    addressLine2?: string;
  };
  /** 店舗受け取りの希望日（YYYY-MM-DD） */
  pickupDate?: string;
  /** 店舗受け取りの希望時刻（HH:MM、09:00〜18:00・30分刻み） */
  pickupTime?: string;
  /** 予約後の追加購入の場合に紐づける予約ID（Phase 19E）。サーバー側で所有者検証を行う。 */
  linkedReservationId?: string;
  /** チェックアウト時にログイン済みだった場合の注文者（Phase 20）。未ログインなら undefined（ゲスト注文）。 */
  userId?: string;
};

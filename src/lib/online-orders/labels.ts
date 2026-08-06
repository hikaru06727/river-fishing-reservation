import type {
  OnlineOrderFulfillmentType,
  OnlineOrderPaymentMethod,
  OnlineOrderPaymentStatus,
  OnlineOrderStatus,
} from "@/types/domain";

export const ONLINE_ORDER_STATUS_LABEL: Record<OnlineOrderStatus, string> = {
  pending_payment: "決済待ち",
  paid: "支払い済み",
  preparing: "準備中",
  ready: "受け取り可能",
  shipped: "発送済み",
  delivered: "受け渡し完了",
  cancelled: "キャンセル",
  refunded: "返金済み",
};

export const ONLINE_ORDER_STATUS_COLOR: Record<OnlineOrderStatus, string> = {
  pending_payment: "bg-slate-100 text-slate-700",
  paid: "bg-blue-100 text-blue-700",
  preparing: "bg-amber-100 text-amber-800",
  ready: "bg-amber-100 text-amber-800",
  shipped: "bg-sky-100 text-sky-700",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-red-100 text-red-700",
};

export const ONLINE_ORDER_FULFILLMENT_LABEL: Record<OnlineOrderFulfillmentType, string> = {
  shipping: "配送",
  pickup: "店舗受け取り",
};

export const ONLINE_ORDER_PAYMENT_METHOD_LABEL: Record<OnlineOrderPaymentMethod, string> = {
  stripe: "クレジットカード決済",
  in_person: "現地決済",
};

export const ONLINE_ORDER_PAYMENT_STATUS_LABEL: Record<OnlineOrderPaymentStatus, string> = {
  pending: "未払い",
  paid: "支払い済み",
  failed: "失敗",
  refunded: "返金済み",
};

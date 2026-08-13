/** 権限定義の集約ファイル。将来のDB権限テーブル化を想定しここに集約する。 */
export const PERMISSIONS = {
  /** レジ操作 */
  POS_OPERATE: ["business_admin", "staff"],
  /** レジ締め */
  POS_CLOSE: ["business_admin", "staff"],
  /** 締め後修正リクエスト送信 */
  CLOSE_CORRECTION_REQUEST: ["business_admin", "staff"],
  /** 締め後修正リクエスト承認 */
  CLOSE_CORRECTION_APPROVE: ["business_admin"],
  /** 予約閲覧 */
  RESERVATION_VIEW: ["business_admin", "staff"],
  /** 予約現金受取完了 */
  RESERVATION_CASH_COMPLETE: ["business_admin", "staff"],
  /** 売上閲覧 */
  SALES_VIEW: ["business_admin", "staff"],
  /** 返金操作 */
  REFUND_MANAGE: ["business_admin", "staff"],
  /** アドオン後処理失敗の要対応管理（閲覧）。対応済み操作はサービス層で admin/business_admin のみに絞る */
  ADDON_CLEANUP_MANAGE: ["business_admin", "staff"],
  /** 商品管理 */
  PRODUCT_MANAGE: ["business_admin", "staff"],
  /** スタッフ管理 */
  STAFF_MANAGE: ["business_admin"],
  /** 営業日・料金設定 */
  BUSINESS_SETTINGS: ["business_admin"],
  /** 税率設定 */
  TAX_SETTINGS: ["business_admin"],
  /** 注文閲覧 */
  ORDER_VIEW: ["business_admin", "staff"],
  /** 注文ステータス変更・受け取り確認 */
  ORDER_STATUS_MANAGE: ["business_admin"],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function hasPermission(role: string, permission: PermissionKey): boolean {
  if (role === "admin") return true;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

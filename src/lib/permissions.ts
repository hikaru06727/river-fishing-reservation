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
  /** 商品管理 */
  PRODUCT_MANAGE: ["business_admin"],
  /** スタッフ管理 */
  STAFF_MANAGE: ["business_admin"],
  /** 営業日・料金設定 */
  BUSINESS_SETTINGS: ["business_admin"],
  /** 税率設定 */
  TAX_SETTINGS: ["business_admin"],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function hasPermission(role: string, permission: PermissionKey): boolean {
  if (role === "admin") return true;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

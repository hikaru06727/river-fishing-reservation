-- ============================================================
-- SQL Editor ブロック 4d / 10
-- 004: GRANT / COMMENT（expire 関連）
-- ============================================================

COMMENT ON FUNCTION get_affected_slot_ids_for_reservation(
  UUID, UUID, DATE, UUID
) IS '予約の開始スロット + プラン時間から、booked_count 更新対象の hourly スロット ID 配列を返す';

COMMENT ON FUNCTION expire_pending_reservations() IS
  '決済未完了の pending 予約（作成から 30 分経過）を expired にし、占有していた空き枠を解放する。将来は expires_at ベースへの切替を想定（関数内コメント参照）';

REVOKE ALL ON FUNCTION get_affected_slot_ids_for_reservation(
  UUID, UUID, DATE, UUID
) FROM PUBLIC;

REVOKE ALL ON FUNCTION expire_pending_reservations() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_affected_slot_ids_for_reservation(
  UUID, UUID, DATE, UUID
) TO postgres, service_role;

GRANT EXECUTE ON FUNCTION expire_pending_reservations() TO postgres, service_role;

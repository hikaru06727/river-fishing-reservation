-- ============================================================
-- SQL Editor ブロック 3 / 10
-- 003: GRANT / REVOKE / COMMENT（003 の2関数作成後に実行）
-- ============================================================

REVOKE ALL ON FUNCTION create_reservation_atomic(
  UUID, UUID, UUID, UUID, DATE, TIME, TIME, INT, INT, TIMESTAMPTZ, UUID[]
) FROM PUBLIC;

REVOKE ALL ON FUNCTION cancel_reservation_atomic(
  UUID, UUID, UUID[], INT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_reservation_atomic(
  UUID, UUID, UUID, UUID, DATE, TIME, TIME, INT, INT, TIMESTAMPTZ, UUID[]
) TO service_role;

GRANT EXECUTE ON FUNCTION cancel_reservation_atomic(
  UUID, UUID, UUID[], INT
) TO service_role;

COMMENT ON FUNCTION create_reservation_atomic(
  UUID, UUID, UUID, UUID, DATE, TIME, TIME, INT, INT, TIMESTAMPTZ, UUID[]
) IS '予約作成 + 影響スロット booked_count 増加を単一トランザクションで原子的に実行';

COMMENT ON FUNCTION cancel_reservation_atomic(
  UUID, UUID, UUID[], INT
) IS '予約キャンセル + 影響スロット booked_count 減少を単一トランザクションで原子的に実行';

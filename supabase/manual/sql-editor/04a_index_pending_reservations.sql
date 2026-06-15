-- ============================================================
-- SQL Editor ブロック 4a / 10
-- 004: pending 予約失効用 部分インデックス
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_reservations_pending_created_at
  ON reservations (created_at)
  WHERE status = 'pending';

COMMENT ON INDEX idx_reservations_pending_created_at IS
  'expire_pending_reservations が 30 分経過 pending を検索するための部分インデックス';

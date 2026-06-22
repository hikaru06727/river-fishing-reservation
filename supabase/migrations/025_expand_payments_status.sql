-- ============================================================
-- Migration 025: payments.status CHECK 制約を拡張
--
-- 既存データへの影響:
--   現行値 pending / succeeded / failed / refunded はすべて新制約に含まれるため
--   既存行への破壊的変更なし。
-- ============================================================

-- PostgreSQL が自動命名した CHECK 制約を削除して再作成
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN (
    'pending',
    'succeeded',
    'failed',
    'refunded',
    'partially_refunded',
    'expired',
    'disputed'
  ));

COMMENT ON COLUMN payments.status IS
  '決済ステータス: pending / succeeded / failed / refunded / partially_refunded / expired / disputed';

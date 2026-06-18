-- 009: pending 期限切れメール送信済みタイムスタンプ
-- Supabase SQL Editor 用（migrations/009 と同一）

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS expired_email_sent_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN reservations.expired_email_sent_at IS
  'online 決済 pending の期限切れ通知メール送信日時。NULL=未送信。';

CREATE INDEX IF NOT EXISTS idx_reservations_expired_email_pending
  ON reservations (updated_at)
  WHERE status = 'expired'
    AND payment_method = 'online'
    AND expired_email_sent_at IS NULL;

COMMENT ON INDEX idx_reservations_expired_email_pending IS
  '期限切れメール未送信の expired online 予約を Cron が検索するための部分インデックス';

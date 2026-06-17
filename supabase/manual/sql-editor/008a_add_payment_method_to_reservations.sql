-- 008a: reservations.payment_method カラム追加
-- 実行順: 008a → 008b → 008c → 008d

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'online'
  CHECK (payment_method IN ('online', 'cash_at_venue'));

COMMENT ON COLUMN reservations.payment_method IS
  'online=Stripe決済（pending→confirmed）, cash_at_venue=当日現金精算（即confirmed）';

CREATE INDEX IF NOT EXISTS idx_reservations_pending_online_expire
  ON reservations (COALESCE(expires_at, created_at))
  WHERE status = 'pending' AND payment_method = 'online';

COMMENT ON INDEX idx_reservations_pending_online_expire IS
  'expire_pending_reservations: online pending の失効対象検索用';

-- ============================================================
-- Migration 043: sale_refunds テーブル作成（Phase L-C）
--
-- 既存の refunds テーブル（予約専用）とは別に
-- POS売上・予約両方を対象とした汎用返金テーブルを作成する。
-- ============================================================

CREATE TABLE IF NOT EXISTS sale_refunds (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sale_session_id       UUID         REFERENCES sale_sessions(id) ON DELETE SET NULL,
  reservation_id        UUID         REFERENCES reservations(id) ON DELETE SET NULL,
  stripe_refund_id      TEXT         UNIQUE,
  stripe_payment_intent_id TEXT,
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method        TEXT         NOT NULL CHECK (payment_method IN ('cash', 'card', 'other')),
  reason                TEXT,
  refunded_by           UUID         NOT NULL REFERENCES profiles(id),
  refunded_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  status                TEXT         NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'completed', 'failed')),
  note                  TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT sale_refunds_sale_or_reservation CHECK (
    (sale_session_id IS NOT NULL AND reservation_id IS NULL) OR
    (sale_session_id IS NULL AND reservation_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_sale_refunds_business_id
  ON sale_refunds (business_id);
CREATE INDEX IF NOT EXISTS idx_sale_refunds_refunded_at
  ON sale_refunds (refunded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_refunds_sale_session_id
  ON sale_refunds (sale_session_id);
CREATE INDEX IF NOT EXISTS idx_sale_refunds_reservation_id
  ON sale_refunds (reservation_id);
CREATE INDEX IF NOT EXISTS idx_sale_refunds_status
  ON sale_refunds (status);

COMMENT ON TABLE sale_refunds IS 'POS売上・予約の返金記録（Phase L-C）';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE sale_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_refunds_admin_all" ON sale_refunds;
CREATE POLICY "sale_refunds_admin_all"
  ON sale_refunds
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "sale_refunds_business_admin_all" ON sale_refunds;
CREATE POLICY "sale_refunds_business_admin_all"
  ON sale_refunds
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

-- staff: SELECT + INSERT のみ
DROP POLICY IF EXISTS "sale_refunds_staff_select" ON sale_refunds;
CREATE POLICY "sale_refunds_staff_select"
  ON sale_refunds
  FOR SELECT
  TO authenticated
  USING (is_staff() AND can_manage_business(business_id));

DROP POLICY IF EXISTS "sale_refunds_staff_insert" ON sale_refunds;
CREATE POLICY "sale_refunds_staff_insert"
  ON sale_refunds
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff() AND can_manage_business(business_id));

-- ------------------------------------------------------------
-- GRANT
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON sale_refunds TO authenticated;

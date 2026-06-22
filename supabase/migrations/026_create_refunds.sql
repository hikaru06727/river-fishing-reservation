-- ============================================================
-- Migration 026: refunds テーブル作成
-- ============================================================

CREATE TABLE IF NOT EXISTS refunds (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        UUID         NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  reservation_id    UUID         NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  amount_yen        INTEGER      NOT NULL CHECK (amount_yen > 0),
  tax_rate_percent  INTEGER      NOT NULL CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100),
  reason            TEXT         NOT NULL,
  refund_type       TEXT         NOT NULL CHECK (refund_type IN ('full', 'partial')),
  stripe_refund_id  TEXT,
  refunded_by       UUID         NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  refunded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id     ON refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_reservation_id ON refunds (reservation_id);

COMMENT ON TABLE refunds IS '返金記録。full / partial のどちらかの返金タイプを持つ。';
COMMENT ON COLUMN refunds.refund_type       IS '返金種別: full（全額返金）/ partial（部分返金）';
COMMENT ON COLUMN refunds.tax_rate_percent  IS '返金時点に適用した税率スナップショット';
COMMENT ON COLUMN refunds.stripe_refund_id  IS 'Stripe Refund ID（現金払い返金の場合は NULL）';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- admin は全件操作可
DROP POLICY IF EXISTS "refunds_admin_all" ON refunds;
CREATE POLICY "refunds_admin_all"
  ON refunds
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin は担当ロケーションに紐づく予約の返金のみ参照・操作可
DROP POLICY IF EXISTS "refunds_business_admin_all" ON refunds;
CREATE POLICY "refunds_business_admin_all"
  ON refunds
  FOR ALL
  USING (
    is_business_admin()
    AND EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.id = refunds.reservation_id
        AND can_manage_location(r.spot_id)
    )
  )
  WITH CHECK (
    is_business_admin()
    AND EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.id = refunds.reservation_id
        AND can_manage_location(r.spot_id)
    )
  );

COMMENT ON POLICY "refunds_admin_all"          ON refunds IS 'admin は全返金を操作可';
COMMENT ON POLICY "refunds_business_admin_all" ON refunds IS 'business_admin は担当ロケーションの返金のみ操作可';

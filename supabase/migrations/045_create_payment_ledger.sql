-- ============================================================
-- Migration 045: payment_ledger テーブル作成（Phase L-E）
--
-- 目的:
--   sale_sessions / reservations / manual_sales の支払い情報を
--   単一テーブルで横断管理するための台帳。
--   既存の payments テーブル（Stripe専用・migration 001）とは別物。
--
-- 変更内容:
--   1. payment_ledger テーブル作成
--   2. インデックス追加
--   3. RLS ポリシー設定
--   4. 権限付与（GRANT）
-- ============================================================

-- ------------------------------------------------------------
-- 1. payment_ledger テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_ledger (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_type    TEXT         NOT NULL
                               CHECK (source_type IN ('pos', 'reservation', 'manual')),
  source_id      UUID         NOT NULL,
  amount         INTEGER      NOT NULL CHECK (amount >= 0),
  payment_method TEXT         NOT NULL
                               CHECK (payment_method IN ('cash', 'card', 'other')),
  status         TEXT         NOT NULL DEFAULT 'pending'
                               CHECK (status IN (
                                 'pending',
                                 'succeeded',
                                 'refunded',
                                 'partially_refunded',
                                 'cancelled'
                               )),
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

COMMENT ON TABLE payment_ledger IS '売上支払い台帳（POS/予約/手動売上を横断管理）（Phase L-E）';
COMMENT ON COLUMN payment_ledger.source_type IS '売上種別: pos=sale_sessions, reservation=reservations, manual=manual_sales';
COMMENT ON COLUMN payment_ledger.source_id   IS '参照元テーブルの id';
COMMENT ON COLUMN payment_ledger.amount      IS '税込み合計（円）';

-- ------------------------------------------------------------
-- 2. インデックス
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payment_ledger_business_source
  ON payment_ledger (business_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_payment_ledger_business_status
  ON payment_ledger (business_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_ledger_business_paid_at
  ON payment_ledger (business_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_ledger_source
  ON payment_ledger (source_type, source_id);

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
ALTER TABLE payment_ledger ENABLE ROW LEVEL SECURITY;

-- admin: 全件アクセス可
DROP POLICY IF EXISTS "payment_ledger_admin_all" ON payment_ledger;
CREATE POLICY "payment_ledger_admin_all"
  ON payment_ledger
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin: 自事業者のみ全操作
DROP POLICY IF EXISTS "payment_ledger_business_admin_all" ON payment_ledger;
CREATE POLICY "payment_ledger_business_admin_all"
  ON payment_ledger
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

-- staff: SELECT + INSERT のみ（UPDATE は business_admin 以上）
DROP POLICY IF EXISTS "payment_ledger_staff_select" ON payment_ledger;
CREATE POLICY "payment_ledger_staff_select"
  ON payment_ledger
  FOR SELECT
  TO authenticated
  USING (is_staff() AND can_manage_business(business_id));

DROP POLICY IF EXISTS "payment_ledger_staff_insert" ON payment_ledger;
CREATE POLICY "payment_ledger_staff_insert"
  ON payment_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff() AND can_manage_business(business_id));

-- ------------------------------------------------------------
-- 4. GRANT
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON payment_ledger TO authenticated;

-- ============================================================
-- Migration 051: booth_bookings テーブル作成 + payment_ledger拡張（Phase 14）
--
-- 目的:
--   ブース枠の予約・販売記録を管理するテーブル。
--   payment_ledger に source_type='booth' を追加して売上台帳と連携する。
--
-- 変更内容:
--   1. booth_bookings テーブル作成
--   2. インデックス追加
--   3. RLS ポリシー設定
--   4. 権限付与（GRANT）
--   5. payment_ledger.source_type の CHECK 制約拡張
-- ============================================================

-- ------------------------------------------------------------
-- 1. booth_bookings テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booth_bookings (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID           NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booth_slot_id  UUID           NOT NULL REFERENCES booth_slots(id) ON DELETE RESTRICT,
  customer_name  TEXT           NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  quantity       INTEGER        NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price     INTEGER        NOT NULL CHECK (unit_price >= 0),
  tax_rate       NUMERIC(5, 2)  NOT NULL CHECK (tax_rate >= 0),
  total_amount   INTEGER        NOT NULL CHECK (total_amount >= 0),
  payment_status TEXT           NOT NULL DEFAULT 'pending'
                 CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  source         TEXT           NOT NULL DEFAULT 'pos'
                 CHECK (source IN ('pos', 'online')),
  notes          TEXT,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

COMMENT ON TABLE booth_bookings IS 'ブース枠の予約・販売記録（Phase 14）';
COMMENT ON COLUMN booth_bookings.unit_price    IS '販売時の税抜き単価スナップショット（円）';
COMMENT ON COLUMN booth_bookings.tax_rate      IS '販売時の税率スナップショット（例: 10.00）';
COMMENT ON COLUMN booth_bookings.total_amount  IS '税込み合計金額（円）';
COMMENT ON COLUMN booth_bookings.payment_status IS 'pending=未払い, paid=支払済み, refunded=返金済み';
COMMENT ON COLUMN booth_bookings.source        IS 'pos=レジから販売, online=オンライン販売（将来用）';

-- ------------------------------------------------------------
-- 2. インデックス
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_booth_bookings_business_id
  ON booth_bookings (business_id);

CREATE INDEX IF NOT EXISTS idx_booth_bookings_slot_id
  ON booth_bookings (booth_slot_id);

CREATE INDEX IF NOT EXISTS idx_booth_bookings_business_status
  ON booth_bookings (business_id, payment_status);

CREATE INDEX IF NOT EXISTS idx_booth_bookings_created_at
  ON booth_bookings (business_id, created_at DESC);

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
ALTER TABLE booth_bookings ENABLE ROW LEVEL SECURITY;

-- admin: 全件アクセス可
DROP POLICY IF EXISTS "booth_bookings_admin_all" ON booth_bookings;
CREATE POLICY "booth_bookings_admin_all"
  ON booth_bookings
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin: 自事業者のみ全操作
DROP POLICY IF EXISTS "booth_bookings_business_admin_all" ON booth_bookings;
CREATE POLICY "booth_bookings_business_admin_all"
  ON booth_bookings
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

-- staff: SELECT + INSERT のみ（レジからの販売）
DROP POLICY IF EXISTS "booth_bookings_staff_select" ON booth_bookings;
CREATE POLICY "booth_bookings_staff_select"
  ON booth_bookings
  FOR SELECT
  TO authenticated
  USING (is_staff() AND can_manage_business(business_id));

DROP POLICY IF EXISTS "booth_bookings_staff_insert" ON booth_bookings;
CREATE POLICY "booth_bookings_staff_insert"
  ON booth_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff() AND can_manage_business(business_id));

-- ------------------------------------------------------------
-- 4. GRANT
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON booth_bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON booth_bookings TO service_role;

-- ------------------------------------------------------------
-- 5. payment_ledger.source_type に 'booth' を追加
-- ------------------------------------------------------------
ALTER TABLE payment_ledger
  DROP CONSTRAINT IF EXISTS payment_ledger_source_type_check;

ALTER TABLE payment_ledger
  ADD CONSTRAINT payment_ledger_source_type_check
    CHECK (source_type IN ('pos', 'reservation', 'manual', 'booth'));

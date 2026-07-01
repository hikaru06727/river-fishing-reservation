-- ============================================================
-- Migration 055: online_orders テーブル作成（Phase 19B）
--
-- 背景:
--   顧客向けECサイトのカート・チェックアウト機能のため、注文を
--   記録する online_orders を新設する。予約（reservations）と
--   同様、ゲスト顧客（auth.uid() なし）が作成するため、書き込みは
--   service_role 経由のみとし、anon への直接 INSERT 権限は付与しない
--   （016_grant_public_read_privileges.sql の方針を踏襲）。
--
-- 決済方式:
--   Stripe Checkout（リダイレクト型）を使用する。既存の予約決済と
--   同じ方式のため、stripe_checkout_session_id を保持する
--   （payments テーブルと同じカラム名）。
-- ============================================================

-- ------------------------------------------------------------
-- 1. online_orders テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS online_orders (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status                      TEXT        NOT NULL DEFAULT 'pending_payment'
                                           CHECK (status IN (
                                             'pending_payment', 'paid', 'preparing',
                                             'ready', 'shipped', 'delivered',
                                             'cancelled', 'refunded'
                                           )),
  fulfillment_type            TEXT        NOT NULL
                                           CHECK (fulfillment_type IN ('shipping', 'pickup')),
  payment_method               TEXT       NOT NULL
                                           CHECK (payment_method IN ('stripe', 'in_person')),
  payment_status               TEXT       NOT NULL DEFAULT 'pending'
                                           CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  stripe_checkout_session_id   TEXT,
  subtotal_amount              INTEGER    NOT NULL CHECK (subtotal_amount >= 0),
  tax_amount                   INTEGER    NOT NULL CHECK (tax_amount >= 0),
  total_amount                 INTEGER    NOT NULL CHECK (total_amount >= 0),
  customer_name                 TEXT      NOT NULL,
  customer_email                 TEXT     NOT NULL,
  customer_phone                 TEXT,
  shipping_postal_code             TEXT,
  shipping_prefecture              TEXT,
  shipping_address_line1           TEXT,
  shipping_address_line2           TEXT,
  notes                             TEXT,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE online_orders IS '顧客向けECサイトの注文（Phase 19B）';
COMMENT ON COLUMN online_orders.subtotal_amount IS '税抜き合計（円）';
COMMENT ON COLUMN online_orders.tax_amount      IS '消費税（円）';
COMMENT ON COLUMN online_orders.total_amount    IS '税込み合計（円）';

-- ------------------------------------------------------------
-- 2. インデックス
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_online_orders_business_status
  ON online_orders (business_id, status);

CREATE INDEX IF NOT EXISTS idx_online_orders_stripe_session
  ON online_orders (stripe_checkout_session_id);

-- ------------------------------------------------------------
-- 3. RLS
--    書き込み（注文作成・Webhook更新）は service_role 経由のみ。
--    authenticated への GRANT は管理画面からの状態更新用。
-- ------------------------------------------------------------
ALTER TABLE online_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "online_orders_admin_all" ON online_orders;
CREATE POLICY "online_orders_admin_all"
  ON online_orders FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "online_orders_business_admin_all" ON online_orders;
CREATE POLICY "online_orders_business_admin_all"
  ON online_orders FOR ALL TO authenticated
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

DROP POLICY IF EXISTS "online_orders_staff_select" ON online_orders;
CREATE POLICY "online_orders_staff_select"
  ON online_orders FOR SELECT TO authenticated
  USING (is_staff() AND can_manage_business(business_id));

-- ------------------------------------------------------------
-- 4. GRANT
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON online_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON online_orders TO service_role;

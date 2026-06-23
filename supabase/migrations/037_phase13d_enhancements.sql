-- ============================================================
-- Migration 037: Phase 13D enhancements
-- ============================================================

-- 1. products: デフォルト税率・カテゴリ追加
ALTER TABLE products
  ADD COLUMN default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10.0,
  ADD COLUMN category TEXT;

COMMENT ON COLUMN products.default_tax_rate IS 'デフォルト消費税率（%）。10 = 標準税率, 8 = 軽減税率';
COMMENT ON COLUMN products.category         IS '商品カテゴリ（自由記述）';

-- 2. sale_session_items: 税率カラム追加
ALTER TABLE sale_session_items
  ADD COLUMN tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 10.0;

COMMENT ON COLUMN sale_session_items.tax_rate_percent IS '明細行に適用した消費税率スナップショット';

-- 3. sale_sessions: 割引・支払方法拡張
ALTER TABLE sale_sessions
  ADD COLUMN discount_amount    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN payment_other_label TEXT;

COMMENT ON COLUMN sale_sessions.discount_amount     IS '割引合計金額（円）';
COMMENT ON COLUMN sale_sessions.payment_other_label IS 'payment_method = other のときの支払方法ラベル';

-- sale_sessions.payment_method 制約を拡張
ALTER TABLE sale_sessions
  DROP CONSTRAINT IF EXISTS sale_sessions_payment_method_check;
ALTER TABLE sale_sessions
  ADD CONSTRAINT sale_sessions_payment_method_check
    CHECK (payment_method IN ('cash', 'stripe', 'credit_card', 'e_money', 'qr', 'other'));

-- 4. product_sales.payment_method 制約を拡張（POS 新支払方法対応）
ALTER TABLE product_sales
  DROP CONSTRAINT IF EXISTS product_sales_payment_method_check;
ALTER TABLE product_sales
  ADD CONSTRAINT product_sales_payment_method_check
    CHECK (payment_method IN ('cash', 'stripe', 'credit_card', 'e_money', 'qr', 'other'));

-- 5. sale_session_discounts テーブル
CREATE TABLE IF NOT EXISTS sale_session_discounts (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_session_id UUID         NOT NULL REFERENCES sale_sessions(id)     ON DELETE CASCADE,
  discount_type   TEXT         NOT NULL CHECK (discount_type IN ('amount', 'rate')),
  target          TEXT         NOT NULL CHECK (target IN ('item', 'session')),
  target_item_id  UUID         REFERENCES sale_session_items(id)         ON DELETE SET NULL,
  discount_value  NUMERIC      NOT NULL,
  discount_amount INTEGER      NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_session_discounts_session_id
  ON sale_session_discounts (sale_session_id);

COMMENT ON TABLE sale_session_discounts IS 'POS 販売セッションの割引明細';

-- RLS
ALTER TABLE sale_session_discounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON sale_session_discounts TO authenticated;

CREATE POLICY "sale_session_discounts_admin_all"
  ON sale_session_discounts FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "sale_session_discounts_business_admin_all"
  ON sale_session_discounts FOR ALL
  USING (
    is_business_admin() AND EXISTS (
      SELECT 1 FROM sale_sessions ss
      WHERE ss.id = sale_session_id
        AND can_manage_business(ss.business_id)
    )
  )
  WITH CHECK (
    is_business_admin() AND EXISTS (
      SELECT 1 FROM sale_sessions ss
      WHERE ss.id = sale_session_id
        AND can_manage_business(ss.business_id)
    )
  );

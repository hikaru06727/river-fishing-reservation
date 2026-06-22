-- ============================================================
-- Migration 027: manual_sales テーブル作成
-- ============================================================

CREATE TABLE IF NOT EXISTS manual_sales (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID         NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  location_id      UUID         REFERENCES locations(id) ON DELETE SET NULL,
  sale_date        DATE         NOT NULL,
  amount_yen       INTEGER      NOT NULL CHECK (amount_yen >= 0),
  tax_rate_percent INTEGER      NOT NULL CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100),
  category         TEXT         NOT NULL
                     CHECK (category IN ('bait', 'rental', 'parking', 'food', 'event', 'other')),
  payment_method   TEXT         NOT NULL
                     CHECK (payment_method IN ('cash', 'card', 'qr', 'other')),
  description      TEXT,
  recorded_by      UUID         NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS manual_sales_updated_at ON manual_sales;
CREATE TRIGGER manual_sales_updated_at
  BEFORE UPDATE ON manual_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_manual_sales_business_id ON manual_sales (business_id);
CREATE INDEX IF NOT EXISTS idx_manual_sales_sale_date   ON manual_sales (sale_date);
CREATE INDEX IF NOT EXISTS idx_manual_sales_location_id ON manual_sales (location_id);

COMMENT ON TABLE manual_sales IS '手動売上記録（餌・レンタル・駐車場等、予約システム外の売上）';
COMMENT ON COLUMN manual_sales.amount_yen       IS '税抜き金額（円）';
COMMENT ON COLUMN manual_sales.tax_rate_percent IS '記録時点に適用した税率スナップショット';
COMMENT ON COLUMN manual_sales.category         IS '売上カテゴリ: bait / rental / parking / food / event / other';
COMMENT ON COLUMN manual_sales.payment_method   IS '支払方法: cash / card / qr / other';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE manual_sales ENABLE ROW LEVEL SECURITY;

-- admin は全件操作可
DROP POLICY IF EXISTS "manual_sales_admin_all" ON manual_sales;
CREATE POLICY "manual_sales_admin_all"
  ON manual_sales
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin は担当事業の売上のみ操作可
DROP POLICY IF EXISTS "manual_sales_business_admin_all" ON manual_sales;
CREATE POLICY "manual_sales_business_admin_all"
  ON manual_sales
  FOR ALL
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

COMMENT ON POLICY "manual_sales_admin_all"          ON manual_sales IS 'admin は全手動売上を操作可';
COMMENT ON POLICY "manual_sales_business_admin_all" ON manual_sales IS 'business_admin は担当事業の手動売上のみ操作可';

-- ============================================================
-- Migration 031: product_sales テーブル作成
-- ============================================================

CREATE TABLE IF NOT EXISTS product_sales (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID         NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  product_id               UUID         NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity                 INTEGER      NOT NULL CHECK (quantity > 0),
  unit_price_excluding_tax INTEGER      NOT NULL CHECK (unit_price_excluding_tax >= 0),
  tax_rate_percent         INTEGER      NOT NULL CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100),
  payment_method           TEXT         NOT NULL CHECK (payment_method IN ('stripe', 'cash')),
  status                   TEXT         NOT NULL DEFAULT 'completed'
                             CHECK (status IN ('pending', 'completed', 'refunded')),
  recorded_by              UUID         NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  purchased_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS product_sales_updated_at ON product_sales;
CREATE TRIGGER product_sales_updated_at
  BEFORE UPDATE ON product_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_product_sales_business_id  ON product_sales (business_id);
CREATE INDEX IF NOT EXISTS idx_product_sales_product_id   ON product_sales (product_id);
CREATE INDEX IF NOT EXISTS idx_product_sales_purchased_at ON product_sales (purchased_at);

COMMENT ON TABLE product_sales IS '商品販売記録（現地販売・オンライン販売の購入履歴）';
COMMENT ON COLUMN product_sales.unit_price_excluding_tax IS '購入時の税抜き単価スナップショット（商品マスタから取得）';
COMMENT ON COLUMN product_sales.tax_rate_percent         IS '購入時に適用した税率スナップショット（tax_rates から取得）';
COMMENT ON COLUMN product_sales.payment_method           IS '支払方法: stripe / cash';
COMMENT ON COLUMN product_sales.status                   IS '販売状態: pending（Stripe決済待ち）/ completed（確定）/ refunded（返金済み）';
COMMENT ON COLUMN product_sales.recorded_by              IS '販売を登録したスタッフの profiles.id';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE product_sales ENABLE ROW LEVEL SECURITY;

-- admin は全件操作可
DROP POLICY IF EXISTS "product_sales_admin_all" ON product_sales;
CREATE POLICY "product_sales_admin_all"
  ON product_sales
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin は担当事業の販売記録のみ操作可
DROP POLICY IF EXISTS "product_sales_business_admin_all" ON product_sales;
CREATE POLICY "product_sales_business_admin_all"
  ON product_sales
  FOR ALL
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

COMMENT ON POLICY "product_sales_admin_all"          ON product_sales IS 'admin は全販売記録を操作可';
COMMENT ON POLICY "product_sales_business_admin_all" ON product_sales IS 'business_admin は担当事業の販売記録のみ操作可';

-- service_role 権限
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_sales TO service_role;

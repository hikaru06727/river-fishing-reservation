-- ============================================================
-- Migration 030: products テーブル作成
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID         NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name                 TEXT         NOT NULL,
  description          TEXT,
  price_excluding_tax  INTEGER      NOT NULL CHECK (price_excluding_tax >= 0),
  stock_quantity       INTEGER      CHECK (stock_quantity >= 0), -- NULL = 在庫無制限
  image_url            TEXT,
  status               TEXT         NOT NULL DEFAULT 'on_sale'
                         CHECK (status IN ('on_sale', 'off_sale', 'archived')),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_products_business_id ON products (business_id);
CREATE INDEX IF NOT EXISTS idx_products_status      ON products (status);

COMMENT ON TABLE products IS '販売商品マスタ（釣り餌・レンタル用品等）';
COMMENT ON COLUMN products.price_excluding_tax IS '税抜き価格（円）';
COMMENT ON COLUMN products.stock_quantity      IS '在庫数。NULL = 在庫無制限';
COMMENT ON COLUMN products.status             IS '販売ステータス: on_sale / off_sale / archived';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- admin は全件操作可
DROP POLICY IF EXISTS "products_admin_all" ON products;
CREATE POLICY "products_admin_all"
  ON products
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin は担当事業の商品のみ操作可
DROP POLICY IF EXISTS "products_business_admin_all" ON products;
CREATE POLICY "products_business_admin_all"
  ON products
  FOR ALL
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

COMMENT ON POLICY "products_admin_all"          ON products IS 'admin は全商品を操作可';
COMMENT ON POLICY "products_business_admin_all" ON products IS 'business_admin は担当事業の商品のみ操作可';

-- service_role 権限
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO service_role;

-- ============================================================
-- Migration 056: online_order_items テーブル作成 + payment_ledger 拡張（Phase 19B）
--
-- 変更内容:
--   1. online_order_items テーブル作成（注文明細のスナップショット）
--   2. payment_ledger.source_type に 'online_order' を追加
--      （precedent: migration 051/052 の 'booth' 追加/削除と同じ手順）
-- ============================================================

-- ------------------------------------------------------------
-- 1. online_order_items テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS online_order_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID        NOT NULL REFERENCES online_orders(id) ON DELETE CASCADE,
  product_id   UUID        NOT NULL REFERENCES products(id),
  product_name TEXT        NOT NULL,
  unit_price   INTEGER     NOT NULL CHECK (unit_price >= 0),
  tax_rate     NUMERIC     NOT NULL,
  quantity     INTEGER     NOT NULL CHECK (quantity > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE online_order_items IS '注文明細（商品名・単価・税率は注文時点のスナップショット）';
COMMENT ON COLUMN online_order_items.unit_price IS '税抜き単価（円・スナップショット）';

CREATE INDEX IF NOT EXISTS idx_online_order_items_order_id
  ON online_order_items (order_id);

-- ------------------------------------------------------------
-- 2. RLS（online_orders と同じスコープを order_id 経由の JOIN で判定）
-- ------------------------------------------------------------
ALTER TABLE online_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "online_order_items_admin_all" ON online_order_items;
CREATE POLICY "online_order_items_admin_all"
  ON online_order_items FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "online_order_items_business_admin_all" ON online_order_items;
CREATE POLICY "online_order_items_business_admin_all"
  ON online_order_items FOR ALL TO authenticated
  USING (
    is_business_admin() AND EXISTS (
      SELECT 1 FROM online_orders o
      WHERE o.id = order_id AND can_manage_business(o.business_id)
    )
  )
  WITH CHECK (
    is_business_admin() AND EXISTS (
      SELECT 1 FROM online_orders o
      WHERE o.id = order_id AND can_manage_business(o.business_id)
    )
  );

DROP POLICY IF EXISTS "online_order_items_staff_select" ON online_order_items;
CREATE POLICY "online_order_items_staff_select"
  ON online_order_items FOR SELECT TO authenticated
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM online_orders o
      WHERE o.id = order_id AND can_manage_business(o.business_id)
    )
  );

-- ------------------------------------------------------------
-- 3. GRANT
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON online_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON online_order_items TO service_role;

-- ------------------------------------------------------------
-- 4. payment_ledger.source_type に 'online_order' を追加
-- ------------------------------------------------------------
ALTER TABLE payment_ledger
  DROP CONSTRAINT IF EXISTS payment_ledger_source_type_check;

ALTER TABLE payment_ledger
  ADD CONSTRAINT payment_ledger_source_type_check
    CHECK (source_type IN ('pos', 'reservation', 'manual', 'online_order'));

COMMENT ON COLUMN payment_ledger.source_type IS
  '売上種別: pos=sale_sessions, reservation=reservations, manual=manual_sales, online_order=online_orders';

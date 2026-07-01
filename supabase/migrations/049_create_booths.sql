-- ============================================================
-- Migration 049: booths テーブル作成（Phase 14）
--
-- 目的:
--   ブース・出店枠のマスタ管理。
--   場所・名称・収容人数・価格・ステータスを管理する。
--
-- 変更内容:
--   1. booths テーブル作成
--   2. インデックス追加
--   3. RLS ポリシー設定
--   4. 権限付与（GRANT）
-- ============================================================

-- ------------------------------------------------------------
-- 1. booths テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booths (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id  UUID        REFERENCES locations(id) ON DELETE SET NULL,
  name         TEXT        NOT NULL,
  description  TEXT,
  capacity     INTEGER     NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  price        INTEGER     NOT NULL DEFAULT 0 CHECK (price >= 0),
  tax_category TEXT        NOT NULL DEFAULT 'standard'
               CHECK (tax_category IN ('standard', 'reduced')),
  status       TEXT        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'inactive')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE booths IS 'ブース・出店枠マスタ（Phase 14）';
COMMENT ON COLUMN booths.price        IS '税抜き単価（円）';
COMMENT ON COLUMN booths.tax_category IS '税区分: standard=標準税率, reduced=軽減税率';
COMMENT ON COLUMN booths.capacity     IS '収容人数（表示用）';

-- ------------------------------------------------------------
-- 2. インデックス
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_booths_business_id
  ON booths (business_id);

CREATE INDEX IF NOT EXISTS idx_booths_business_status
  ON booths (business_id, status);

CREATE INDEX IF NOT EXISTS idx_booths_location_id
  ON booths (location_id);

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
ALTER TABLE booths ENABLE ROW LEVEL SECURITY;

-- admin: 全件アクセス可
DROP POLICY IF EXISTS "booths_admin_all" ON booths;
CREATE POLICY "booths_admin_all"
  ON booths
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin: 自事業者のみ全操作
DROP POLICY IF EXISTS "booths_business_admin_all" ON booths;
CREATE POLICY "booths_business_admin_all"
  ON booths
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

-- staff: SELECT のみ
DROP POLICY IF EXISTS "booths_staff_select" ON booths;
CREATE POLICY "booths_staff_select"
  ON booths
  FOR SELECT
  TO authenticated
  USING (is_staff() AND can_manage_business(business_id));

-- ------------------------------------------------------------
-- 4. GRANT
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON booths TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON booths TO service_role;

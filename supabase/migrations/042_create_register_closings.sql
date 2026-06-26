-- ============================================================
-- Migration 042: レジ締めテーブル（Phase L-B）
--
-- 変更内容:
--   1. register_closings テーブル作成
--   2. register_closing_corrections テーブル作成
--   3. RLS ポリシー設定
--   4. インデックス作成
--   5. 権限付与（GRANT）
-- ============================================================

-- ------------------------------------------------------------
-- 1. register_closings — レジ締め記録
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS register_closings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  closed_by       UUID NOT NULL REFERENCES profiles(id),
  closed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  total_cash      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_card      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_other     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'closed'
                    CHECK (status IN ('closed', 'correction_requested', 'approved')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_register_closings_business_id
  ON register_closings (business_id);
CREATE INDEX IF NOT EXISTS idx_register_closings_closed_at
  ON register_closings (closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_register_closings_status
  ON register_closings (status);

COMMENT ON TABLE register_closings IS 'レジ締め記録（Phase L-B）';

-- ------------------------------------------------------------
-- 2. register_closing_corrections — 修正リクエスト
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS register_closing_corrections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id      UUID NOT NULL REFERENCES register_closings(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES profiles(id),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason          TEXT NOT NULL,
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_register_closing_corrections_closing_id
  ON register_closing_corrections (closing_id);
CREATE INDEX IF NOT EXISTS idx_register_closing_corrections_status
  ON register_closing_corrections (status);

COMMENT ON TABLE register_closing_corrections IS 'レジ締め修正リクエスト（Phase L-B）';

-- ------------------------------------------------------------
-- 3. RLS — register_closings
-- ------------------------------------------------------------
ALTER TABLE register_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "register_closings_admin_all" ON register_closings;
CREATE POLICY "register_closings_admin_all"
  ON register_closings
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "register_closings_business_admin_all" ON register_closings;
CREATE POLICY "register_closings_business_admin_all"
  ON register_closings
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

-- staff: SELECT + INSERT のみ（UPDATE 不可）
DROP POLICY IF EXISTS "register_closings_staff_select" ON register_closings;
CREATE POLICY "register_closings_staff_select"
  ON register_closings
  FOR SELECT
  TO authenticated
  USING (is_staff() AND can_manage_business(business_id));

DROP POLICY IF EXISTS "register_closings_staff_insert" ON register_closings;
CREATE POLICY "register_closings_staff_insert"
  ON register_closings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_staff() AND can_manage_business(business_id));

-- ------------------------------------------------------------
-- 4. RLS — register_closing_corrections
-- ------------------------------------------------------------
ALTER TABLE register_closing_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "register_closing_corrections_admin_all" ON register_closing_corrections;
CREATE POLICY "register_closing_corrections_admin_all"
  ON register_closing_corrections
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin は自事業の締め記録に対する修正リクエストを管理
DROP POLICY IF EXISTS "register_closing_corrections_ba_all" ON register_closing_corrections;
CREATE POLICY "register_closing_corrections_ba_all"
  ON register_closing_corrections
  FOR ALL
  TO authenticated
  USING (
    is_business_admin() AND EXISTS (
      SELECT 1 FROM register_closings rc
      WHERE rc.id = closing_id
        AND can_manage_business(rc.business_id)
    )
  )
  WITH CHECK (
    is_business_admin() AND EXISTS (
      SELECT 1 FROM register_closings rc
      WHERE rc.id = closing_id
        AND can_manage_business(rc.business_id)
    )
  );

-- staff: SELECT + INSERT のみ
DROP POLICY IF EXISTS "register_closing_corrections_staff_select" ON register_closing_corrections;
CREATE POLICY "register_closing_corrections_staff_select"
  ON register_closing_corrections
  FOR SELECT
  TO authenticated
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM register_closings rc
      WHERE rc.id = closing_id
        AND can_manage_business(rc.business_id)
    )
  );

DROP POLICY IF EXISTS "register_closing_corrections_staff_insert" ON register_closing_corrections;
CREATE POLICY "register_closing_corrections_staff_insert"
  ON register_closing_corrections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_staff() AND EXISTS (
      SELECT 1 FROM register_closings rc
      WHERE rc.id = closing_id
        AND can_manage_business(rc.business_id)
    )
  );

-- ------------------------------------------------------------
-- 5. GRANT
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON register_closings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON register_closing_corrections TO authenticated;

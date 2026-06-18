-- ============================================================
-- 010: 釣り場別プラン管理（plans 拡張 + RLS）
-- 実行順: 010（009_add_expired_email_sent_at.sql の後）
--
-- 方針:
--   - 既存の共通プラン（1h/3h）は fishing_spot_id = NULL のまま維持
--   - 新規プランは fishing_spot_id で釣り場に紐づける
--   - 既存予約フロー・RPC・Stripe には触れない
-- ============================================================

-- ------------------------------------------------------------
-- 1. plans テーブル拡張
-- ------------------------------------------------------------
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS fishing_spot_id UUID REFERENCES fishing_spots(id) ON DELETE CASCADE;

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS max_guests INT NOT NULL DEFAULT 10 CHECK (max_guests > 0);

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS is_accepting_reservations BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN plans.fishing_spot_id IS '釣り場固有プラン。NULL は従来の共通プラン（1h/3h）';
COMMENT ON COLUMN plans.description IS 'プラン説明';
COMMENT ON COLUMN plans.max_guests IS '1予約あたりの最大人数';
COMMENT ON COLUMN plans.is_visible IS '公開画面での表示可否';
COMMENT ON COLUMN plans.is_accepting_reservations IS '新規予約受付可否';

-- 既存行の backfill（DEFAULT 適用済みだが明示）
UPDATE plans
SET
  is_visible = TRUE,
  is_accepting_reservations = TRUE,
  updated_at = COALESCE(updated_at, created_at)
WHERE fishing_spot_id IS NULL;

DROP TRIGGER IF EXISTS plans_updated_at ON plans;
CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- slug 一意制約: 共通プランは slug 単独、釣り場別は (spot, slug)
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS plans_global_slug_unique
  ON plans (slug)
  WHERE fishing_spot_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS plans_spot_slug_unique
  ON plans (fishing_spot_id, slug)
  WHERE fishing_spot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_plans_fishing_spot_id
  ON plans (fishing_spot_id);

-- ------------------------------------------------------------
-- 2. plans RLS 再定義
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "plans_public_read" ON plans;
CREATE POLICY "plans_public_read"
  ON plans
  FOR SELECT
  USING (
    (
      is_active = TRUE
      AND is_visible = TRUE
      AND (
        fishing_spot_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM fishing_spots fs
          WHERE fs.id = plans.fishing_spot_id
            AND fs.is_active = TRUE
        )
      )
    )
    OR is_admin()
    OR is_management()
  );

DROP POLICY IF EXISTS "plans_admin_all" ON plans;
CREATE POLICY "plans_admin_all"
  ON plans
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "plans_business_admin_select" ON plans;
CREATE POLICY "plans_business_admin_select"
  ON plans
  FOR SELECT
  TO authenticated
  USING (
    is_business_admin()
    AND fishing_spot_id IS NOT NULL
    AND can_manage_spot(fishing_spot_id)
  );

DROP POLICY IF EXISTS "plans_business_admin_insert" ON plans;
CREATE POLICY "plans_business_admin_insert"
  ON plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_business_admin()
    AND fishing_spot_id IS NOT NULL
    AND can_manage_spot(fishing_spot_id)
  );

DROP POLICY IF EXISTS "plans_business_admin_update" ON plans;
CREATE POLICY "plans_business_admin_update"
  ON plans
  FOR UPDATE
  TO authenticated
  USING (
    is_business_admin()
    AND fishing_spot_id IS NOT NULL
    AND can_manage_spot(fishing_spot_id)
  )
  WITH CHECK (
    is_business_admin()
    AND fishing_spot_id IS NOT NULL
    AND can_manage_spot(fishing_spot_id)
  );

DROP POLICY IF EXISTS "plans_business_admin_delete" ON plans;
CREATE POLICY "plans_business_admin_delete"
  ON plans
  FOR DELETE
  TO authenticated
  USING (
    is_business_admin()
    AND fishing_spot_id IS NOT NULL
    AND can_manage_spot(fishing_spot_id)
  );

COMMENT ON POLICY "plans_business_admin_select" ON plans IS
  'business_admin は担当釣り場のプランのみ SELECT（共通プランは不可）';

-- ============================================================
-- Migration 050: booth_slots テーブル作成（Phase 14）
--
-- 目的:
--   ブースの「日付×時間帯の枠」を管理する販売単位テーブル。
--   管理画面から期間・時間帯を指定して一括生成する手動バッチ方式。
--
-- 変更内容:
--   1. booth_slots テーブル作成
--   2. インデックス追加
--   3. RLS ポリシー設定
--   4. 権限付与（GRANT）
-- ============================================================

-- ------------------------------------------------------------
-- 1. booth_slots テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booth_slots (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booth_id     UUID        NOT NULL REFERENCES booths(id) ON DELETE CASCADE,
  date         DATE        NOT NULL,
  start_time   TIME        NOT NULL,
  end_time     TIME        NOT NULL,
  max_bookings INTEGER     NOT NULL DEFAULT 1 CHECK (max_bookings >= 1),
  status       TEXT        NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'closed', 'full')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booth_id, date, start_time),
  CHECK (end_time > start_time)
);

COMMENT ON TABLE booth_slots IS 'ブース枠（日付×時間帯の販売単位）（Phase 14）';
COMMENT ON COLUMN booth_slots.max_bookings IS '受付上限（この枠で受け付けられる予約数）';
COMMENT ON COLUMN booth_slots.status       IS 'open=受付中, closed=クローズ, full=満席（service層で自動更新）';

-- ------------------------------------------------------------
-- 2. インデックス
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_booth_slots_booth_id
  ON booth_slots (booth_id);

CREATE INDEX IF NOT EXISTS idx_booth_slots_business_date
  ON booth_slots (business_id, date);

CREATE INDEX IF NOT EXISTS idx_booth_slots_booth_date
  ON booth_slots (booth_id, date);

CREATE INDEX IF NOT EXISTS idx_booth_slots_business_status
  ON booth_slots (business_id, status);

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
ALTER TABLE booth_slots ENABLE ROW LEVEL SECURITY;

-- admin: 全件アクセス可
DROP POLICY IF EXISTS "booth_slots_admin_all" ON booth_slots;
CREATE POLICY "booth_slots_admin_all"
  ON booth_slots
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin: 自事業者のみ全操作
DROP POLICY IF EXISTS "booth_slots_business_admin_all" ON booth_slots;
CREATE POLICY "booth_slots_business_admin_all"
  ON booth_slots
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

-- staff: SELECT のみ（レジ販売時に枠を参照する）
DROP POLICY IF EXISTS "booth_slots_staff_select" ON booth_slots;
CREATE POLICY "booth_slots_staff_select"
  ON booth_slots
  FOR SELECT
  TO authenticated
  USING (is_staff() AND can_manage_business(business_id));

-- staff: UPDATE のみ（service層でstatus更新に必要）
DROP POLICY IF EXISTS "booth_slots_staff_update" ON booth_slots;
CREATE POLICY "booth_slots_staff_update"
  ON booth_slots
  FOR UPDATE
  TO authenticated
  USING (is_staff() AND can_manage_business(business_id));

-- ------------------------------------------------------------
-- 4. GRANT
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON booth_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON booth_slots TO service_role;

-- ============================================================
-- 019: 釣り場休み時間・中休み（Phase 10b）
-- 実行順: 018_grant_service_role_table_privileges.sql の後
--
-- fishing_spot_weekly_breaks: 曜日別の予約不可時間帯（複数可）
-- fishing_spot_exception_breaks: 例外日専用の予約不可時間帯
-- fishing_spot_date_exceptions.ignore_weekly_breaks: 例外日で曜日休みを無視
--
-- 日跨ぎ休憩: Phase 10b 非対応（start_time < end_time）
-- ============================================================

ALTER TABLE fishing_spot_date_exceptions
  ADD COLUMN IF NOT EXISTS ignore_weekly_breaks BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN fishing_spot_date_exceptions.ignore_weekly_breaks IS
  'TRUE のとき例外営業日で曜日別休み時間を適用しない（exception_breaks のみ）';

-- ------------------------------------------------------------
-- fishing_spot_weekly_breaks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fishing_spot_weekly_breaks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fishing_spot_id  UUID NOT NULL REFERENCES fishing_spots(id) ON DELETE CASCADE,
  day_of_week      SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  label            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT weekly_breaks_time_check CHECK (start_time < end_time),
  UNIQUE (fishing_spot_id, day_of_week, start_time, end_time)
);

COMMENT ON TABLE fishing_spot_weekly_breaks IS '釣り場の曜日別休み時間（昼休み・清掃など、1曜日に複数可）';
COMMENT ON COLUMN fishing_spot_weekly_breaks.day_of_week IS '0=日曜, 1=月曜, …, 6=土曜';

CREATE INDEX IF NOT EXISTS idx_weekly_breaks_fishing_spot_id
  ON fishing_spot_weekly_breaks (fishing_spot_id);

CREATE INDEX IF NOT EXISTS idx_weekly_breaks_spot_day
  ON fishing_spot_weekly_breaks (fishing_spot_id, day_of_week);

DROP TRIGGER IF EXISTS fishing_spot_weekly_breaks_updated_at ON fishing_spot_weekly_breaks;
CREATE TRIGGER fishing_spot_weekly_breaks_updated_at
  BEFORE UPDATE ON fishing_spot_weekly_breaks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- fishing_spot_exception_breaks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fishing_spot_exception_breaks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_exception_id  UUID NOT NULL REFERENCES fishing_spot_date_exceptions(id) ON DELETE CASCADE,
  start_time         TIME NOT NULL,
  end_time           TIME NOT NULL,
  label              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exception_breaks_time_check CHECK (start_time < end_time),
  UNIQUE (date_exception_id, start_time, end_time)
);

COMMENT ON TABLE fishing_spot_exception_breaks IS '例外日の休み時間（イベント準備・臨時休憩など）';

CREATE INDEX IF NOT EXISTS idx_exception_breaks_date_exception_id
  ON fishing_spot_exception_breaks (date_exception_id);

DROP TRIGGER IF EXISTS fishing_spot_exception_breaks_updated_at ON fishing_spot_exception_breaks;
CREATE TRIGGER fishing_spot_exception_breaks_updated_at
  BEFORE UPDATE ON fishing_spot_exception_breaks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE fishing_spot_weekly_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fishing_spot_exception_breaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_breaks_public_read" ON fishing_spot_weekly_breaks;
CREATE POLICY "weekly_breaks_public_read"
  ON fishing_spot_weekly_breaks
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "weekly_breaks_admin_all" ON fishing_spot_weekly_breaks;
CREATE POLICY "weekly_breaks_admin_all"
  ON fishing_spot_weekly_breaks
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "weekly_breaks_business_admin_all" ON fishing_spot_weekly_breaks;
CREATE POLICY "weekly_breaks_business_admin_all"
  ON fishing_spot_weekly_breaks
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_spot(fishing_spot_id))
  WITH CHECK (is_business_admin() AND can_manage_spot(fishing_spot_id));

DROP POLICY IF EXISTS "exception_breaks_public_read" ON fishing_spot_exception_breaks;
CREATE POLICY "exception_breaks_public_read"
  ON fishing_spot_exception_breaks
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "exception_breaks_admin_all" ON fishing_spot_exception_breaks;
CREATE POLICY "exception_breaks_admin_all"
  ON fishing_spot_exception_breaks
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "exception_breaks_business_admin_all" ON fishing_spot_exception_breaks;
CREATE POLICY "exception_breaks_business_admin_all"
  ON fishing_spot_exception_breaks
  FOR ALL
  TO authenticated
  USING (
    is_business_admin()
    AND EXISTS (
      SELECT 1
      FROM fishing_spot_date_exceptions e
      WHERE e.id = date_exception_id
        AND can_manage_spot(e.fishing_spot_id)
    )
  )
  WITH CHECK (
    is_business_admin()
    AND EXISTS (
      SELECT 1
      FROM fishing_spot_date_exceptions e
      WHERE e.id = date_exception_id
        AND can_manage_spot(e.fishing_spot_id)
    )
  );

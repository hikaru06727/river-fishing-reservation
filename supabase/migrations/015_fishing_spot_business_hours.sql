-- ============================================================
-- 015: 釣り場営業時間・例外日（Phase 10）
-- 実行順: 014_dual_path_affected_slot_ids.sql の後
--
-- fishing_spot_weekly_hours: 曜日別営業時間テンプレート
-- fishing_spot_date_exceptions: 特定日の臨時休業・特別営業
--
-- 未設定 spot（weekly 0 行）: 既存予約挙動を維持（アプリ層で判定）
-- 日跨ぎ営業（22:00〜翌2:00）: Phase 10 非対応（open_time < close_time を要求）
-- ============================================================

-- ------------------------------------------------------------
-- fishing_spot_weekly_hours
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fishing_spot_weekly_hours (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fishing_spot_id  UUID NOT NULL REFERENCES fishing_spots(id) ON DELETE CASCADE,
  day_of_week      SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open          BOOLEAN NOT NULL DEFAULT TRUE,
  open_time        TIME,
  close_time       TIME,
  is_24_hours      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fishing_spot_id, day_of_week),
  CONSTRAINT weekly_hours_time_check CHECK (
    (is_open = FALSE)
    OR (is_24_hours = TRUE)
    OR (
      open_time IS NOT NULL
      AND close_time IS NOT NULL
      AND open_time < close_time
    )
  )
);

COMMENT ON TABLE fishing_spot_weekly_hours IS '釣り場の曜日別営業時間（0=日曜 … 6=土曜）';
COMMENT ON COLUMN fishing_spot_weekly_hours.day_of_week IS '0=日曜, 1=月曜, …, 6=土曜';
COMMENT ON COLUMN fishing_spot_weekly_hours.is_24_hours IS 'TRUE のとき open_time/close_time は NULL 可（終日営業）';

CREATE INDEX IF NOT EXISTS idx_weekly_hours_fishing_spot_id
  ON fishing_spot_weekly_hours (fishing_spot_id);

DROP TRIGGER IF EXISTS fishing_spot_weekly_hours_updated_at ON fishing_spot_weekly_hours;
CREATE TRIGGER fishing_spot_weekly_hours_updated_at
  BEFORE UPDATE ON fishing_spot_weekly_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- fishing_spot_date_exceptions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fishing_spot_date_exceptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fishing_spot_id  UUID NOT NULL REFERENCES fishing_spots(id) ON DELETE CASCADE,
  exception_date   DATE NOT NULL,
  is_open          BOOLEAN NOT NULL DEFAULT FALSE,
  open_time        TIME,
  close_time       TIME,
  is_24_hours      BOOLEAN NOT NULL DEFAULT FALSE,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fishing_spot_id, exception_date),
  CONSTRAINT date_exceptions_time_check CHECK (
    (is_open = FALSE)
    OR (is_24_hours = TRUE)
    OR (
      open_time IS NOT NULL
      AND close_time IS NOT NULL
      AND open_time < close_time
    )
  )
);

COMMENT ON TABLE fishing_spot_date_exceptions IS '釣り場の特定日営業例外（臨時休業・短縮営業・祝日営業など）';
COMMENT ON COLUMN fishing_spot_date_exceptions.exception_date IS '対象日（例外は曜日設定より優先）';

CREATE INDEX IF NOT EXISTS idx_date_exceptions_fishing_spot_id
  ON fishing_spot_date_exceptions (fishing_spot_id);

CREATE INDEX IF NOT EXISTS idx_date_exceptions_spot_date
  ON fishing_spot_date_exceptions (fishing_spot_id, exception_date);

DROP TRIGGER IF EXISTS fishing_spot_date_exceptions_updated_at ON fishing_spot_date_exceptions;
CREATE TRIGGER fishing_spot_date_exceptions_updated_at
  BEFORE UPDATE ON fishing_spot_date_exceptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE fishing_spot_weekly_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE fishing_spot_date_exceptions ENABLE ROW LEVEL SECURITY;

-- weekly_hours: 公開 read（予約画面用）
DROP POLICY IF EXISTS "weekly_hours_public_read" ON fishing_spot_weekly_hours;
CREATE POLICY "weekly_hours_public_read"
  ON fishing_spot_weekly_hours
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "weekly_hours_admin_all" ON fishing_spot_weekly_hours;
CREATE POLICY "weekly_hours_admin_all"
  ON fishing_spot_weekly_hours
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "weekly_hours_business_admin_all" ON fishing_spot_weekly_hours;
CREATE POLICY "weekly_hours_business_admin_all"
  ON fishing_spot_weekly_hours
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_spot(fishing_spot_id))
  WITH CHECK (is_business_admin() AND can_manage_spot(fishing_spot_id));

-- date_exceptions: 公開 read
DROP POLICY IF EXISTS "date_exceptions_public_read" ON fishing_spot_date_exceptions;
CREATE POLICY "date_exceptions_public_read"
  ON fishing_spot_date_exceptions
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "date_exceptions_admin_all" ON fishing_spot_date_exceptions;
CREATE POLICY "date_exceptions_admin_all"
  ON fishing_spot_date_exceptions
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "date_exceptions_business_admin_all" ON fishing_spot_date_exceptions;
CREATE POLICY "date_exceptions_business_admin_all"
  ON fishing_spot_date_exceptions
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_spot(fishing_spot_id))
  WITH CHECK (is_business_admin() AND can_manage_spot(fishing_spot_id));

-- ============================================================
-- 022: fishing_spots → locations 全面リネーム
-- 実行順: 021_add_date_exception_tag_type.sql の後
--
-- 変更内容:
--   テーブル:
--     fishing_spots               → locations
--     fishing_spot_weekly_hours   → location_weekly_hours
--     fishing_spot_date_exceptions→ location_date_exceptions
--     fishing_spot_weekly_breaks  → location_weekly_breaks
--     fishing_spot_exception_breaks→location_exception_breaks
--
--   カラム (fishing_spot_id → location_id):
--     plans.fishing_spot_id
--     location_weekly_hours.fishing_spot_id
--     location_date_exceptions.fishing_spot_id
--     location_weekly_breaks.fishing_spot_id
--
--   関数:
--     can_manage_spot(UUID) → can_manage_location(UUID)
--
--   RLS ポリシー:
--     can_manage_spot / fishing_spots / fishing_spot_id 参照をすべて更新
--
--   RPC:
--     generate_fifteen_minute_availability_slots: fishing_spots → locations 参照更新
-- ============================================================

-- ============================================================
-- 1. テーブルリネーム
-- ============================================================

ALTER TABLE fishing_spots               RENAME TO locations;
ALTER TABLE fishing_spot_weekly_hours   RENAME TO location_weekly_hours;
ALTER TABLE fishing_spot_date_exceptions RENAME TO location_date_exceptions;
ALTER TABLE fishing_spot_weekly_breaks  RENAME TO location_weekly_breaks;
ALTER TABLE fishing_spot_exception_breaks RENAME TO location_exception_breaks;

-- ============================================================
-- 2. カラムリネーム (fishing_spot_id → location_id)
--    ※ PostgreSQL が部分インデックス条件・制約式を自動更新する
-- ============================================================

ALTER TABLE plans                   RENAME COLUMN fishing_spot_id TO location_id;
ALTER TABLE location_weekly_hours   RENAME COLUMN fishing_spot_id TO location_id;
ALTER TABLE location_date_exceptions RENAME COLUMN fishing_spot_id TO location_id;
ALTER TABLE location_weekly_breaks  RENAME COLUMN fishing_spot_id TO location_id;

-- ============================================================
-- 3. トリガーリネーム
-- ============================================================

ALTER TRIGGER fishing_spots_updated_at
  ON locations RENAME TO locations_updated_at;

ALTER TRIGGER fishing_spot_weekly_hours_updated_at
  ON location_weekly_hours RENAME TO location_weekly_hours_updated_at;

ALTER TRIGGER fishing_spot_date_exceptions_updated_at
  ON location_date_exceptions RENAME TO location_date_exceptions_updated_at;

ALTER TRIGGER fishing_spot_weekly_breaks_updated_at
  ON location_weekly_breaks RENAME TO location_weekly_breaks_updated_at;

ALTER TRIGGER fishing_spot_exception_breaks_updated_at
  ON location_exception_breaks RENAME TO location_exception_breaks_updated_at;

-- ============================================================
-- 4. インデックスリネーム
-- ============================================================

ALTER INDEX idx_fishing_spots_slug            RENAME TO idx_locations_slug;
ALTER INDEX idx_fishing_spots_business_id     RENAME TO idx_locations_business_id;
ALTER INDEX idx_weekly_hours_fishing_spot_id  RENAME TO idx_location_weekly_hours_location_id;
ALTER INDEX idx_date_exceptions_fishing_spot_id RENAME TO idx_location_date_exceptions_location_id;
ALTER INDEX idx_date_exceptions_spot_date     RENAME TO idx_location_date_exceptions_location_date;
ALTER INDEX idx_weekly_breaks_fishing_spot_id RENAME TO idx_location_weekly_breaks_location_id;
ALTER INDEX idx_weekly_breaks_spot_day        RENAME TO idx_location_weekly_breaks_location_day;
ALTER INDEX idx_plans_fishing_spot_id         RENAME TO idx_plans_location_id;

-- ============================================================
-- 5. 制約リネーム
--    ※ postgres-error.ts でハードコードされている一意制約名を更新
-- ============================================================

ALTER TABLE location_date_exceptions
  RENAME CONSTRAINT fishing_spot_date_exceptions_fishing_spot_id_exception_date_key
  TO location_date_exceptions_location_id_exception_date_key;

-- FK 制約名を新命名規則に合わせる
ALTER TABLE location_weekly_hours
  RENAME CONSTRAINT fishing_spot_weekly_hours_fishing_spot_id_fkey
  TO location_weekly_hours_location_id_fkey;

ALTER TABLE location_date_exceptions
  RENAME CONSTRAINT fishing_spot_date_exceptions_fishing_spot_id_fkey
  TO location_date_exceptions_location_id_fkey;

ALTER TABLE location_weekly_breaks
  RENAME CONSTRAINT fishing_spot_weekly_breaks_fishing_spot_id_fkey
  TO location_weekly_breaks_location_id_fkey;

ALTER TABLE plans
  RENAME CONSTRAINT plans_fishing_spot_id_fkey
  TO plans_location_id_fkey;

-- ============================================================
-- 6. can_manage_location 関数を作成（can_manage_spot の後継）
--    ※ locations テーブルが存在するこの時点で作成する
-- ============================================================

CREATE OR REPLACE FUNCTION can_manage_location(p_location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN is_admin() THEN TRUE
    WHEN p_location_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM locations l
      WHERE l.id = p_location_id
        AND can_manage_business(l.business_id)
    )
  END;
$$;

COMMENT ON FUNCTION can_manage_location(UUID) IS
  'admin は全 location、business_admin は担当事業の location のみ（旧: can_manage_spot）';

-- ============================================================
-- 7. RLS ポリシー再定義
--    ・can_manage_spot → can_manage_location
--    ・fishing_spots  → locations テーブル参照
--    ・fishing_spot_id → location_id カラム参照
-- ============================================================

-- ------------------------------------------------------------
-- locations（旧 fishing_spots）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "spots_public_read"          ON locations;
DROP POLICY IF EXISTS "spots_admin_all"             ON locations;
DROP POLICY IF EXISTS "spots_business_admin_update" ON locations;

CREATE POLICY "spots_public_read"
  ON locations
  FOR SELECT
  USING (
    is_active = TRUE
    OR is_admin()
    OR (is_business_admin() AND can_manage_location(id))
  );

CREATE POLICY "spots_admin_all"
  ON locations
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "spots_business_admin_update"
  ON locations
  FOR UPDATE
  TO authenticated
  USING (is_business_admin() AND can_manage_location(id))
  WITH CHECK (is_business_admin() AND can_manage_location(id));

-- ------------------------------------------------------------
-- availability_slots（spot_id カラム名はそのまま）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "slots_public_read"           ON availability_slots;
DROP POLICY IF EXISTS "slots_admin_all"             ON availability_slots;
DROP POLICY IF EXISTS "slots_business_admin_insert" ON availability_slots;
DROP POLICY IF EXISTS "slots_business_admin_update" ON availability_slots;
DROP POLICY IF EXISTS "slots_business_admin_delete" ON availability_slots;

CREATE POLICY "slots_public_read"
  ON availability_slots
  FOR SELECT
  USING (
    status = 'open'
    OR is_admin()
    OR (is_business_admin() AND can_manage_location(spot_id))
  );

CREATE POLICY "slots_admin_all"
  ON availability_slots
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "slots_business_admin_insert"
  ON availability_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (is_business_admin() AND can_manage_location(spot_id));

CREATE POLICY "slots_business_admin_update"
  ON availability_slots
  FOR UPDATE
  TO authenticated
  USING (is_business_admin() AND can_manage_location(spot_id))
  WITH CHECK (is_business_admin() AND can_manage_location(spot_id));

CREATE POLICY "slots_business_admin_delete"
  ON availability_slots
  FOR DELETE
  TO authenticated
  USING (is_business_admin() AND can_manage_location(spot_id));

-- ------------------------------------------------------------
-- reservations（spot_id カラム名はそのまま）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "reservations_business_admin_select" ON reservations;
DROP POLICY IF EXISTS "reservations_business_admin_update" ON reservations;

CREATE POLICY "reservations_business_admin_select"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (
    is_business_admin()
    AND can_manage_location(spot_id)
  );

CREATE POLICY "reservations_business_admin_update"
  ON reservations
  FOR UPDATE
  TO authenticated
  USING (is_business_admin() AND can_manage_location(spot_id))
  WITH CHECK (is_business_admin() AND can_manage_location(spot_id));

-- ------------------------------------------------------------
-- payments（reservation.spot_id 経由で can_manage_location）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "payments_business_admin_select" ON payments;

CREATE POLICY "payments_business_admin_select"
  ON payments
  FOR SELECT
  TO authenticated
  USING (
    is_business_admin()
    AND EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.id = payments.reservation_id
        AND can_manage_location(r.spot_id)
    )
  );

-- ------------------------------------------------------------
-- plans（location_id カラム + locations テーブル参照）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "plans_public_read"            ON plans;
DROP POLICY IF EXISTS "plans_business_admin_select"  ON plans;
DROP POLICY IF EXISTS "plans_business_admin_insert"  ON plans;
DROP POLICY IF EXISTS "plans_business_admin_update"  ON plans;
DROP POLICY IF EXISTS "plans_business_admin_delete"  ON plans;

CREATE POLICY "plans_public_read"
  ON plans
  FOR SELECT
  USING (
    (
      is_active = TRUE
      AND is_visible = TRUE
      AND (
        location_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM locations l
          WHERE l.id = plans.location_id
            AND l.is_active = TRUE
        )
      )
    )
    OR is_admin()
    OR is_management()
  );

CREATE POLICY "plans_business_admin_select"
  ON plans
  FOR SELECT
  TO authenticated
  USING (
    is_business_admin()
    AND location_id IS NOT NULL
    AND can_manage_location(location_id)
  );

CREATE POLICY "plans_business_admin_insert"
  ON plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_business_admin()
    AND location_id IS NOT NULL
    AND can_manage_location(location_id)
  );

CREATE POLICY "plans_business_admin_update"
  ON plans
  FOR UPDATE
  TO authenticated
  USING (
    is_business_admin()
    AND location_id IS NOT NULL
    AND can_manage_location(location_id)
  )
  WITH CHECK (
    is_business_admin()
    AND location_id IS NOT NULL
    AND can_manage_location(location_id)
  );

CREATE POLICY "plans_business_admin_delete"
  ON plans
  FOR DELETE
  TO authenticated
  USING (
    is_business_admin()
    AND location_id IS NOT NULL
    AND can_manage_location(location_id)
  );

COMMENT ON POLICY "plans_business_admin_select" ON plans IS
  'business_admin は担当 location のプランのみ SELECT（共通プランは不可）';

-- ------------------------------------------------------------
-- profiles（locations JOIN に更新）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_business_admin_select" ON profiles;

CREATE POLICY "profiles_business_admin_select"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    is_business_admin()
    AND EXISTS (
      SELECT 1
      FROM reservations r
      INNER JOIN locations l ON l.id = r.spot_id
      WHERE r.user_id = profiles.id
        AND can_manage_business(l.business_id)
    )
  );

-- ------------------------------------------------------------
-- location_weekly_hours（旧 fishing_spot_weekly_hours）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "weekly_hours_public_read"        ON location_weekly_hours;
DROP POLICY IF EXISTS "weekly_hours_admin_all"          ON location_weekly_hours;
DROP POLICY IF EXISTS "weekly_hours_business_admin_all" ON location_weekly_hours;

CREATE POLICY "weekly_hours_public_read"
  ON location_weekly_hours
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "weekly_hours_admin_all"
  ON location_weekly_hours
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "weekly_hours_business_admin_all"
  ON location_weekly_hours
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_location(location_id))
  WITH CHECK (is_business_admin() AND can_manage_location(location_id));

-- ------------------------------------------------------------
-- location_date_exceptions（旧 fishing_spot_date_exceptions）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "date_exceptions_public_read"        ON location_date_exceptions;
DROP POLICY IF EXISTS "date_exceptions_admin_all"          ON location_date_exceptions;
DROP POLICY IF EXISTS "date_exceptions_business_admin_all" ON location_date_exceptions;

CREATE POLICY "date_exceptions_public_read"
  ON location_date_exceptions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "date_exceptions_admin_all"
  ON location_date_exceptions
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "date_exceptions_business_admin_all"
  ON location_date_exceptions
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_location(location_id))
  WITH CHECK (is_business_admin() AND can_manage_location(location_id));

-- ------------------------------------------------------------
-- location_weekly_breaks（旧 fishing_spot_weekly_breaks）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "weekly_breaks_public_read"        ON location_weekly_breaks;
DROP POLICY IF EXISTS "weekly_breaks_admin_all"          ON location_weekly_breaks;
DROP POLICY IF EXISTS "weekly_breaks_business_admin_all" ON location_weekly_breaks;

CREATE POLICY "weekly_breaks_public_read"
  ON location_weekly_breaks
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "weekly_breaks_admin_all"
  ON location_weekly_breaks
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "weekly_breaks_business_admin_all"
  ON location_weekly_breaks
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_location(location_id))
  WITH CHECK (is_business_admin() AND can_manage_location(location_id));

-- ------------------------------------------------------------
-- location_exception_breaks（旧 fishing_spot_exception_breaks）
-- date_exception_id FK 経由で location_date_exceptions.location_id を参照
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "exception_breaks_public_read"        ON location_exception_breaks;
DROP POLICY IF EXISTS "exception_breaks_admin_all"          ON location_exception_breaks;
DROP POLICY IF EXISTS "exception_breaks_business_admin_all" ON location_exception_breaks;

CREATE POLICY "exception_breaks_public_read"
  ON location_exception_breaks
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "exception_breaks_admin_all"
  ON location_exception_breaks
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "exception_breaks_business_admin_all"
  ON location_exception_breaks
  FOR ALL
  TO authenticated
  USING (
    is_business_admin()
    AND EXISTS (
      SELECT 1
      FROM location_date_exceptions e
      WHERE e.id = date_exception_id
        AND can_manage_location(e.location_id)
    )
  )
  WITH CHECK (
    is_business_admin()
    AND EXISTS (
      SELECT 1
      FROM location_date_exceptions e
      WHERE e.id = date_exception_id
        AND can_manage_location(e.location_id)
    )
  );

-- ============================================================
-- 8. generate_fifteen_minute_availability_slots を更新
--    fishing_spots → locations 参照
-- ============================================================

CREATE OR REPLACE FUNCTION generate_fifteen_minute_availability_slots(
  p_spot_id UUID,
  p_from_date DATE,
  p_to_date DATE,
  p_max_capacity INT DEFAULT NULL,
  p_morning_start TIME DEFAULT '09:00',
  p_morning_end TIME DEFAULT '12:00',
  p_afternoon_start TIME DEFAULT '13:00',
  p_afternoon_end TIME DEFAULT '16:00',
  p_step_minutes INT DEFAULT 15
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity INT;
  v_inserted INT;
  v_morning_steps INT;
  v_afternoon_steps INT;
BEGIN
  IF p_from_date > p_to_date THEN
    RAISE EXCEPTION 'p_from_date must be <= p_to_date';
  END IF;

  IF p_step_minutes IS NULL OR p_step_minutes <= 0 THEN
    RAISE EXCEPTION 'p_step_minutes must be positive';
  END IF;

  SELECT COALESCE(p_max_capacity, l.capacity)
  INTO v_capacity
  FROM locations l
  WHERE l.id = p_spot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'location not found: %', p_spot_id;
  END IF;

  IF v_capacity IS NULL OR v_capacity <= 0 THEN
    RAISE EXCEPTION 'max_capacity must be positive for location: %', p_spot_id;
  END IF;

  v_morning_steps := GREATEST(
    (EXTRACT(EPOCH FROM (p_morning_end - p_morning_start)) / 60 / p_step_minutes)::INT,
    0
  );
  v_afternoon_steps := GREATEST(
    (EXTRACT(EPOCH FROM (p_afternoon_end - p_afternoon_start)) / 60 / p_step_minutes)::INT,
    0
  );

  WITH dates AS (
    SELECT gs::DATE AS slot_date
    FROM generate_series(p_from_date, p_to_date, INTERVAL '1 day') AS gs
  ),
  slot_starts AS (
    SELECT
      d.slot_date,
      (p_morning_start + (n * (p_step_minutes || ' minutes')::INTERVAL))::TIME AS start_time
    FROM dates d
    CROSS JOIN generate_series(0, v_morning_steps - 1) AS n
    WHERE v_morning_steps > 0

    UNION ALL

    SELECT
      d.slot_date,
      (p_afternoon_start + (n * (p_step_minutes || ' minutes')::INTERVAL))::TIME AS start_time
    FROM dates d
    CROSS JOIN generate_series(0, v_afternoon_steps - 1) AS n
    WHERE v_afternoon_steps > 0
  ),
  inserted AS (
    INSERT INTO availability_slots (
      spot_id,
      slot_date,
      start_time,
      end_time,
      max_capacity,
      status
    )
    SELECT
      p_spot_id,
      s.slot_date,
      s.start_time,
      (s.start_time + (p_step_minutes || ' minutes')::INTERVAL)::TIME AS end_time,
      v_capacity,
      'open'
    FROM slot_starts s
    ON CONFLICT (spot_id, slot_date, start_time) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION generate_fifteen_minute_availability_slots(
  UUID, DATE, DATE, INT, TIME, TIME, TIME, TIME, INT
) IS
  'seed・初期投入・運用補助用。指定期間に 15 分刻み availability_slots を INSERT（ON CONFLICT DO NOTHING）。'
  '予約 RPC からは呼ばない。production effective_date は migration 外で人が決めて実行する。'
  '暫定営業: 09:00–12:00 / 13:00–16:00（開始上限排他）。max_capacity デフォルトは locations.capacity。';

REVOKE ALL ON FUNCTION generate_fifteen_minute_availability_slots(
  UUID, DATE, DATE, INT, TIME, TIME, TIME, TIME, INT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION generate_fifteen_minute_availability_slots(
  UUID, DATE, DATE, INT, TIME, TIME, TIME, TIME, INT
) TO postgres, service_role;

-- ============================================================
-- 9. can_manage_spot を削除（全 RLS ポリシーが can_manage_location に移行済み）
-- ============================================================

DROP FUNCTION IF EXISTS can_manage_spot(UUID);

-- ============================================================
-- 10. GRANT 再付与
--     ※ PostgreSQL はテーブルリネーム時に OID ベースで GRANT を引き継ぐが、
--       明示的に再付与して 016/017/018/020 との整合を保証する
-- ============================================================

GRANT SELECT ON TABLE
  public.locations,
  public.location_weekly_hours,
  public.location_date_exceptions,
  public.location_weekly_breaks,
  public.location_exception_breaks
TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE
  public.location_weekly_hours,
  public.location_date_exceptions,
  public.location_weekly_breaks,
  public.location_exception_breaks
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.locations,
  public.location_weekly_hours,
  public.location_date_exceptions,
  public.location_weekly_breaks,
  public.location_exception_breaks
TO service_role;

-- ============================================================
-- 11. コメント更新
-- ============================================================

COMMENT ON TABLE locations IS '釣り場マスタ（旧: fishing_spots）';
COMMENT ON TABLE location_weekly_hours IS '釣り場の曜日別営業時間（旧: fishing_spot_weekly_hours）';
COMMENT ON TABLE location_date_exceptions IS '釣り場の特定日営業例外（旧: fishing_spot_date_exceptions）';
COMMENT ON TABLE location_weekly_breaks IS '釣り場の曜日別休み時間（旧: fishing_spot_weekly_breaks）';
COMMENT ON TABLE location_exception_breaks IS '例外日の休み時間（旧: fishing_spot_exception_breaks）';

COMMENT ON TABLE businesses IS '事業（運営単位）。locations の親。';
COMMENT ON COLUMN locations.business_id IS '所属事業。business_admin のスコープ判定に使用。';
COMMENT ON COLUMN location_weekly_hours.location_id IS 'locations.id への外部キー';
COMMENT ON COLUMN location_date_exceptions.location_id IS 'locations.id への外部キー';
COMMENT ON COLUMN location_weekly_breaks.location_id IS 'locations.id への外部キー';
COMMENT ON COLUMN plans.location_id IS '釣り場固有プラン。NULL は従来の共通プラン（1h/3h）';

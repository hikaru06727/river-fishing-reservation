-- ============================================================
-- 048: location_weekly_hours から availability_slots を生成する関数
-- 実行順: 047_backfill_payment_ledger.sql の後
--
-- generate_slots_from_weekly_hours(p_spot_id, p_from_date, p_to_date, p_step_minutes)
--   location_weekly_hours の曜日別営業時間を読んで 15 分刻みのスロットを生成する。
--   既存行は ON CONFLICT DO NOTHING でスキップ。
--   service_role / postgres のみ実行可能（SECURITY DEFINER）。
-- ============================================================

CREATE OR REPLACE FUNCTION generate_slots_from_weekly_hours(
  p_spot_id      UUID,
  p_from_date    DATE,
  p_to_date      DATE,
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
BEGIN
  IF p_from_date > p_to_date THEN
    RAISE EXCEPTION 'p_from_date must be <= p_to_date';
  END IF;

  IF p_step_minutes IS NULL OR p_step_minutes <= 0 THEN
    RAISE EXCEPTION 'p_step_minutes must be positive';
  END IF;

  SELECT capacity
  INTO v_capacity
  FROM locations
  WHERE id = p_spot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'location not found: %', p_spot_id;
  END IF;

  IF v_capacity IS NULL OR v_capacity <= 0 THEN
    RAISE EXCEPTION 'capacity must be positive for location: %', p_spot_id;
  END IF;

  WITH dates AS (
    SELECT
      gs::DATE                          AS slot_date,
      EXTRACT(DOW FROM gs)::SMALLINT    AS dow
    FROM generate_series(p_from_date, p_to_date, INTERVAL '1 day') AS gs
  ),
  slots AS (
    SELECT
      d.slot_date,
      (wh.open_time + (n.step * (p_step_minutes || ' minutes')::INTERVAL))::TIME AS start_time
    FROM dates d
    JOIN location_weekly_hours wh
      ON  wh.location_id  = p_spot_id
      AND wh.day_of_week  = d.dow
      AND wh.is_open      = TRUE
      AND wh.open_time    IS NOT NULL
      AND wh.close_time   IS NOT NULL
    CROSS JOIN LATERAL generate_series(
      0,
      GREATEST(
        (EXTRACT(EPOCH FROM (wh.close_time - wh.open_time)) / 60 / p_step_minutes)::INT - 1,
        -1
      )
    ) AS n(step)
    WHERE (wh.open_time + (n.step * (p_step_minutes || ' minutes')::INTERVAL))::TIME < wh.close_time
  ),
  inserted AS (
    INSERT INTO availability_slots (spot_id, slot_date, start_time, end_time, max_capacity, status)
    SELECT
      p_spot_id,
      s.slot_date,
      s.start_time,
      (s.start_time + (p_step_minutes || ' minutes')::INTERVAL)::TIME AS end_time,
      v_capacity,
      'open'
    FROM slots s
    ON CONFLICT (spot_id, slot_date, start_time) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION generate_slots_from_weekly_hours(UUID, DATE, DATE, INT) IS
  'location_weekly_hours の曜日別営業時間を読み、指定期間の availability_slots を生成する。'
  '既存行は ON CONFLICT DO NOTHING でスキップ。service_role / postgres のみ実行可能。';

REVOKE ALL ON FUNCTION generate_slots_from_weekly_hours(UUID, DATE, DATE, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_slots_from_weekly_hours(UUID, DATE, DATE, INT)
  TO postgres, service_role;

-- ============================================================
-- 初期スロット生成: weekly_hours が設定済みの釣り場の今日から 60 日分
-- ============================================================
DO $$
DECLARE
  v_spot     RECORD;
  v_inserted INT;
BEGIN
  FOR v_spot IN SELECT id, name FROM locations LOOP
    BEGIN
      SELECT generate_slots_from_weekly_hours(
        v_spot.id,
        CURRENT_DATE::DATE,
        (CURRENT_DATE + 60)::DATE
      ) INTO v_inserted;

      IF v_inserted > 0 THEN
        RAISE NOTICE 'Generated % slots for location "%"', v_inserted, v_spot.name;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped location "%" (%)', v_spot.name, SQLERRM;
    END;
  END LOOP;
END;
$$;

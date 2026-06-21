-- ============================================================
-- 013: 15分 availability_slots 生成基盤（Phase 9b）
-- 実行順: 012_use_reserved_duration_for_reservation_slots.sql の後
--
-- 目的:
--   - seed / 初期データ投入 / 運用補助用の生成関数を追加
--   - 予約 RPC（create/cancel/expire）や在庫更新ロジックからは呼ばない
--   - 既存 hourly slot は変更しない（日付分離で 15 分行のみ追加生成）
--
-- Phase 9 暫定:
--   - slot_step = 15 分固定（DB カラム slot_step_minutes は追加しない）
--   - 営業時間: 09:00–12:00, 13:00–16:00（開始時刻は上限排他）
--   - max_capacity: fishing_spots.capacity（引数で上書き可）
--
-- 予約処理は引き続き availability_slots 行 + p_affected_slot_ids を中心とする。
-- get_affected_slot_ids の 15 分対応は 014 / Phase 9c。
-- ============================================================

COMMENT ON TABLE availability_slots IS
  '日別空き枠。各行の粒度は (end_time - start_time) で表現（legacy hourly 60分 / Phase 9 以降 15分）。予約は slot 行 ID の配列で在庫を更新する。';

COMMENT ON COLUMN availability_slots.max_capacity IS
  '当該時間区間の定員上限。remaining_count = min(max_capacity - booked_count) の唯一のソース。';

COMMENT ON COLUMN availability_slots.booked_count IS
  'pending + confirmed の合計占有数。create_reservation_atomic で増加、cancel / expired で減算。';

COMMENT ON VIEW slot_capacity_status IS
  '空き枠の定員・占有・残枠一覧（粒度は行ごとに可変）。remaining_count = max_capacity - booked_count（0 未満は 0 に丸め）';

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

  SELECT COALESCE(p_max_capacity, fs.capacity)
  INTO v_capacity
  FROM fishing_spots fs
  WHERE fs.id = p_spot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fishing spot not found: %', p_spot_id;
  END IF;

  IF v_capacity IS NULL OR v_capacity <= 0 THEN
    RAISE EXCEPTION 'max_capacity must be positive for spot: %', p_spot_id;
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
  '暫定営業: 09:00–12:00 / 13:00–16:00（開始上限排他）。max_capacity デフォルトは fishing_spots.capacity。';

REVOKE ALL ON FUNCTION generate_fifteen_minute_availability_slots(
  UUID, DATE, DATE, INT, TIME, TIME, TIME, TIME, INT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION generate_fifteen_minute_availability_slots(
  UUID, DATE, DATE, INT, TIME, TIME, TIME, TIME, INT
) TO postgres, service_role;

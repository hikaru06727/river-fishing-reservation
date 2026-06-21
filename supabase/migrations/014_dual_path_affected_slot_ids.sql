-- ============================================================
-- 014: get_affected_slot_ids_for_reservation の 15分 / 60分 dual-path 化
-- 実行順: 013_fifteen_minute_availability_slot_generation.sql の後
--
-- Phase 9c:
--   - 開始 slot 行の (end_time - start_time) から slot_step を判定（15 or 60 分）
--   - duration: reserved_duration_minutes → r.end - r.start → 空配列
--   - 途中 slot 欠落時は all-or-nothing（空配列）。部分解放より安全。
--   - expire_pending_reservations / create / cancel RPC は変更しない
-- ============================================================

CREATE OR REPLACE FUNCTION get_affected_slot_ids_for_reservation(
  p_reservation_id UUID
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_spot_id UUID;
  v_reservation_date DATE;
  v_start_time TIME;
  v_reservation_start TIME;
  v_reservation_end TIME;
  v_duration_minutes INT;
  v_slot_step_minutes INT;
  v_expected_count INT;
  v_i INT;
  v_check_time TIME;
  v_ids UUID[] := '{}';
  v_found_id UUID;
BEGIN
  SELECT
    r.spot_id,
    r.reservation_date,
    s.start_time,
    r.start_time,
    r.end_time,
    r.reserved_duration_minutes,
    (EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60)::INT
  INTO
    v_spot_id,
    v_reservation_date,
    v_start_time,
    v_reservation_start,
    v_reservation_end,
    v_duration_minutes,
    v_slot_step_minutes
  FROM reservations r
  INNER JOIN availability_slots s
    ON s.id = r.slot_id
   AND s.spot_id = r.spot_id
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
    RETURN v_ids;
  END IF;

  IF v_slot_step_minutes NOT IN (15, 60) THEN
    RETURN v_ids;
  END IF;

  -- 1. reserved_duration_minutes 2. end - start 3. 不明なら空配列
  IF v_duration_minutes IS NULL OR v_duration_minutes <= 0 THEN
    v_duration_minutes := GREATEST(
      EXTRACT(EPOCH FROM (v_reservation_end - v_reservation_start)) / 60,
      0
    )::INT;
  END IF;

  IF v_duration_minutes IS NULL OR v_duration_minutes <= 0 THEN
    RETURN v_ids;
  END IF;

  IF v_duration_minutes % v_slot_step_minutes <> 0 THEN
    RETURN v_ids;
  END IF;

  v_expected_count := v_duration_minutes / v_slot_step_minutes;

  IF v_expected_count <= 0 THEN
    RETURN v_ids;
  END IF;

  -- start_time 列挙順で ID を収集。1 件でも欠けたら all-or-nothing で空配列。
  FOR v_i IN 0..(v_expected_count - 1) LOOP
    v_check_time := (
      v_start_time + (v_i * v_slot_step_minutes || ' minutes')::INTERVAL
    )::TIME;

    SELECT id
    INTO v_found_id
    FROM availability_slots
    WHERE spot_id = v_spot_id
      AND slot_date = v_reservation_date
      AND start_time = v_check_time;

    IF NOT FOUND THEN
      RETURN '{}'::UUID[];
    END IF;

    v_ids := array_append(v_ids, v_found_id);
  END LOOP;

  IF COALESCE(array_length(v_ids, 1), 0) <> v_expected_count THEN
    RETURN '{}'::UUID[];
  END IF;

  RETURN v_ids;
END;
$$;

COMMENT ON FUNCTION get_affected_slot_ids_for_reservation(UUID) IS
  '予約 snapshot duration から booked_count 更新対象スロット ID を返す。plans 非依存。'
  'slot_step は開始 slot 行の (end_time - start_time) から 15 分 or 60 分 legacy を判定。'
  '途中 slot が 1 件でも欠ける場合は all-or-nothing で空配列（部分解放より安全）。'
  'expire は helper が空なら booked_count を戻さず status のみ expired にする。';

REVOKE ALL ON FUNCTION get_affected_slot_ids_for_reservation(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_affected_slot_ids_for_reservation(UUID) TO postgres, service_role;

-- ============================================================
-- 012: 枠戻し・失効時の duration を reserved_duration_minutes 基準に
-- 実行順: 011_reservation_plan_snapshot.sql の後
--
-- Phase 8d:
--   - get_affected_slot_ids_for_reservation が plans.duration_minutes を参照しない
--   - expire_pending_reservations は helper 経由で snapshot duration を使用
--   - cancel_reservation_atomic は変更なし（アプリが affected_slot_ids を渡す）
-- Phase 9 向け: 現行は 60 分 hourly スロット前提（slot_step = 60）
-- ============================================================

DROP FUNCTION IF EXISTS get_affected_slot_ids_for_reservation(UUID, UUID, DATE, UUID);

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
  v_hour_count INT;
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
    r.reserved_duration_minutes
  INTO
    v_spot_id,
    v_reservation_date,
    v_start_time,
    v_reservation_start,
    v_reservation_end,
    v_duration_minutes
  FROM reservations r
  INNER JOIN availability_slots s
    ON s.id = r.slot_id
   AND s.spot_id = r.spot_id
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
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

  -- 現行: hourly スロット（Phase 9 で slot_step_minutes 化予定）
  IF v_duration_minutes % 60 <> 0 THEN
    RETURN v_ids;
  END IF;

  v_hour_count := v_duration_minutes / 60;

  FOR v_i IN 0..(v_hour_count - 1) LOOP
    v_check_time := (v_start_time + (v_i || ' hours')::interval)::time;

    SELECT id
    INTO v_found_id
    FROM availability_slots
    WHERE spot_id = v_spot_id
      AND slot_date = v_reservation_date
      AND start_time = v_check_time;

    IF FOUND THEN
      v_ids := array_append(v_ids, v_found_id);
    END IF;
  END LOOP;

  RETURN v_ids;
END;
$$;

COMMENT ON FUNCTION get_affected_slot_ids_for_reservation(UUID) IS
  '予約 snapshot duration（reserved_duration_minutes 優先）から booked_count 更新対象スロット ID を返す。plans 非依存。';

-- expire_pending_reservations: helper 呼び出しを reservation_id のみに変更
CREATE OR REPLACE FUNCTION expire_pending_reservations()
RETURNS TABLE (
  expired_count INT,
  reservation_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_affected_ids UUID[];
  v_processed_ids UUID[] := '{}';
  v_count INT := 0;
BEGIN
  FOR v_reservation IN
    SELECT
      id,
      guest_count
    FROM reservations
    WHERE status = 'pending'
      AND payment_method = 'online'
      AND (
        (expires_at IS NOT NULL AND expires_at <= NOW())
        OR (
          expires_at IS NULL
          AND created_at <= NOW() - INTERVAL '30 minutes'
        )
      )
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    v_affected_ids := get_affected_slot_ids_for_reservation(v_reservation.id);

    IF COALESCE(array_length(v_affected_ids, 1), 0) > 0 THEN
      UPDATE availability_slots
      SET booked_count = GREATEST(booked_count - v_reservation.guest_count, 0)
      WHERE id = ANY (v_affected_ids);
    END IF;

    UPDATE reservations
    SET
      status = 'expired',
      updated_at = NOW()
    WHERE id = v_reservation.id
      AND status = 'pending'
      AND payment_method = 'online';

    v_count := v_count + 1;
    v_processed_ids := array_append(v_processed_ids, v_reservation.id);
  END LOOP;

  RETURN QUERY SELECT v_count, v_processed_ids;
END;
$$;

COMMENT ON FUNCTION expire_pending_reservations IS
  'online + pending の決済期限切れ予約のみ expired にし、reserved_duration_minutes 基準で空き枠を解放。cash_at_venue は対象外。';

REVOKE ALL ON FUNCTION get_affected_slot_ids_for_reservation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_affected_slot_ids_for_reservation(UUID) TO postgres, service_role;

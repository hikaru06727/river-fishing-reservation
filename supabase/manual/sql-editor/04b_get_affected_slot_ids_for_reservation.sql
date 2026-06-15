-- ============================================================
-- SQL Editor ブロック 4b / 10
-- 004: get_affected_slot_ids_for_reservation（ヘルパー）
-- ============================================================

CREATE OR REPLACE FUNCTION get_affected_slot_ids_for_reservation(
  p_spot_id UUID,
  p_slot_id UUID,
  p_reservation_date DATE,
  p_plan_id UUID
)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_start_time TIME;
  v_duration_minutes INT;
  v_hour_count INT;
  v_i INT;
  v_check_time TIME;
  v_ids UUID[] := '{}';
  v_found_id UUID;
BEGIN
  SELECT start_time
  INTO v_start_time
  FROM availability_slots
  WHERE id = p_slot_id
    AND spot_id = p_spot_id;

  IF NOT FOUND THEN
    RETURN v_ids;
  END IF;

  SELECT duration_minutes
  INTO v_duration_minutes
  FROM plans
  WHERE id = p_plan_id;

  IF NOT FOUND OR v_duration_minutes IS NULL OR v_duration_minutes < 60 THEN
    RETURN v_ids;
  END IF;

  v_hour_count := v_duration_minutes / 60;

  FOR v_i IN 0..(v_hour_count - 1) LOOP
    v_check_time := (v_start_time + (v_i || ' hours')::interval)::time;

    SELECT id
    INTO v_found_id
    FROM availability_slots
    WHERE spot_id = p_spot_id
      AND slot_date = p_reservation_date
      AND start_time = v_check_time;

    IF FOUND THEN
      v_ids := array_append(v_ids, v_found_id);
    END IF;
  END LOOP;

  RETURN v_ids;
END;
$$;

-- ============================================================
-- 予約の原子的作成・キャンセル（同時実行対策）
-- 実行順: 3番目（002_rls_policies.sql の後に実行）
--
-- create_reservation_atomic / cancel_reservation_atomic は
-- スロット行ロック (FOR UPDATE) + 容量検証 + 更新 + 予約操作を
-- 単一トランザクションで実行し、ダブルブッキングを防ぐ。
-- ============================================================

CREATE OR REPLACE FUNCTION create_reservation_atomic(
  p_user_id UUID,
  p_spot_id UUID,
  p_plan_id UUID,
  p_slot_id UUID,
  p_reservation_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_guest_count INT,
  p_total_amount_yen INT,
  p_expires_at TIMESTAMPTZ,
  p_affected_slot_ids UUID[]
)
RETURNS TABLE (
  reservation_id UUID,
  success BOOLEAN,
  error_code TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot RECORD;
  v_reservation_id UUID;
  v_expected_count INT;
  v_found_count INT;
BEGIN
  IF p_guest_count IS NULL OR p_guest_count < 1 THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'INVALID_GUEST_COUNT', '参加人数が不正です';
    RETURN;
  END IF;

  v_expected_count := COALESCE(array_length(p_affected_slot_ids, 1), 0);
  IF v_expected_count = 0 THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'INVALID_SLOTS', '影響スロットが指定されていません';
    RETURN;
  END IF;

  IF NOT (p_slot_id = ANY (p_affected_slot_ids)) THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'INVALID_START_SLOT', '開始スロットが影響スロットに含まれていません';
    RETURN;
  END IF;

  -- デッドロック防止: id 順で行ロック
  PERFORM 1
  FROM availability_slots
  WHERE id = ANY (p_affected_slot_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT COUNT(*)::INT INTO v_found_count
  FROM availability_slots
  WHERE id = ANY (p_affected_slot_ids);

  IF v_found_count <> v_expected_count THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'MISSING_SLOTS', '必要な空き枠が見つかりません';
    RETURN;
  END IF;

  FOR v_slot IN
    SELECT
      id,
      spot_id,
      slot_date,
      start_time,
      status,
      booked_count,
      max_capacity
    FROM availability_slots
    WHERE id = ANY (p_affected_slot_ids)
    ORDER BY start_time
  LOOP
    IF v_slot.spot_id <> p_spot_id THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'SLOT_MISMATCH', '空き枠が釣り場と一致しません';
      RETURN;
    END IF;

    IF v_slot.slot_date <> p_reservation_date THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'DATE_MISMATCH', '利用日と空き枠が一致しません';
      RETURN;
    END IF;

    IF v_slot.status <> 'open' THEN
      RETURN QUERY
        SELECT NULL::UUID, FALSE, 'SLOT_CLOSED',
          format('%s の枠は現在予約できません', to_char(v_slot.start_time, 'HH24:MI'));
      RETURN;
    END IF;

    IF v_slot.booked_count + p_guest_count > v_slot.max_capacity THEN
      RETURN QUERY
        SELECT NULL::UUID, FALSE, 'CAPACITY_EXCEEDED',
          format(
            '%s の残り枠が不足しています（同時予約の可能性があります）',
            to_char(v_slot.start_time, 'HH24:MI')
          );
      RETURN;
    END IF;
  END LOOP;

  UPDATE availability_slots
  SET booked_count = booked_count + p_guest_count
  WHERE id = ANY (p_affected_slot_ids);

  INSERT INTO reservations (
    user_id,
    spot_id,
    plan_id,
    slot_id,
    reservation_date,
    start_time,
    end_time,
    guest_count,
    total_amount_yen,
    status,
    expires_at
  )
  VALUES (
    p_user_id,
    p_spot_id,
    p_plan_id,
    p_slot_id,
    p_reservation_date,
    p_start_time,
    p_end_time,
    p_guest_count,
    p_total_amount_yen,
    'pending',
    p_expires_at
  )
  RETURNING id INTO v_reservation_id;

  RETURN QUERY SELECT v_reservation_id, TRUE, NULL::TEXT, NULL::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_reservation_atomic(
  p_reservation_id UUID,
  p_user_id UUID,
  p_affected_slot_ids UUID[],
  p_guest_count INT
)
RETURNS TABLE (
  reservation_id UUID,
  success BOOLEAN,
  error_code TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation reservations%ROWTYPE;
  v_expected_count INT;
  v_found_count INT;
BEGIN
  IF p_guest_count IS NULL OR p_guest_count < 1 THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'INVALID_GUEST_COUNT', '参加人数が不正です';
    RETURN;
  END IF;

  v_expected_count := COALESCE(array_length(p_affected_slot_ids, 1), 0);
  IF v_expected_count = 0 THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'INVALID_SLOTS', '影響スロットが指定されていません';
    RETURN;
  END IF;

  SELECT * INTO v_reservation
  FROM reservations
  WHERE id = p_reservation_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'NOT_FOUND', '予約が見つかりません';
    RETURN;
  END IF;

  IF v_reservation.status NOT IN ('pending', 'confirmed') THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'INVALID_STATUS', 'この予約はキャンセルできません';
    RETURN;
  END IF;

  PERFORM 1
  FROM availability_slots
  WHERE id = ANY (p_affected_slot_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT COUNT(*)::INT INTO v_found_count
  FROM availability_slots
  WHERE id = ANY (p_affected_slot_ids);

  IF v_found_count <> v_expected_count THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'MISSING_SLOTS', '空き枠情報の取得に失敗しました';
    RETURN;
  END IF;

  UPDATE reservations
  SET status = 'cancelled'
  WHERE id = p_reservation_id;

  UPDATE availability_slots
  SET booked_count = GREATEST(booked_count - p_guest_count, 0)
  WHERE id = ANY (p_affected_slot_ids);

  RETURN QUERY SELECT p_reservation_id, TRUE, NULL::TEXT, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION create_reservation_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_reservation_atomic FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_reservation_atomic TO service_role;
GRANT EXECUTE ON FUNCTION cancel_reservation_atomic TO service_role;

COMMENT ON FUNCTION create_reservation_atomic IS
  '予約作成 + 影響スロット booked_count 増加を単一トランザクションで原子的に実行';

COMMENT ON FUNCTION cancel_reservation_atomic IS
  '予約キャンセル + 影響スロット booked_count 減少を単一トランザクションで原子的に実行';

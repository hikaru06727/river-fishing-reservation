-- 008c: create_reservation_atomic 拡張（payment_method 対応）
-- 前提: 008a 実行済み

DROP FUNCTION IF EXISTS create_reservation_atomic(
  UUID, UUID, UUID, UUID, DATE, TIME, TIME, INT, INT, TIMESTAMPTZ, UUID[]
);

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
  p_affected_slot_ids UUID[],
  p_payment_method TEXT DEFAULT 'online'
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
  v_locked_count INT := 0;
  v_updated_count INT;
  v_remaining INT;
  v_min_remaining INT := NULL;
  v_bottleneck_time TIME := NULL;
  v_payment_method TEXT;
  v_status TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_guest_count IS NULL OR p_guest_count < 1 THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'INVALID_GUEST_COUNT', '参加人数が不正です';
    RETURN;
  END IF;

  v_payment_method := COALESCE(NULLIF(TRIM(p_payment_method), ''), 'online');

  IF v_payment_method NOT IN ('online', 'cash_at_venue') THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'INVALID_PAYMENT_METHOD', '支払い方法が不正です';
    RETURN;
  END IF;

  IF v_payment_method = 'online' THEN
    v_status := 'pending';
    v_expires_at := p_expires_at;
    IF v_expires_at IS NULL THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'INVALID_EXPIRES_AT', '決済期限が必要です';
      RETURN;
    END IF;
  ELSE
    v_status := 'confirmed';
    v_expires_at := NULL;
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
    ORDER BY id
    FOR UPDATE
  LOOP
    v_locked_count := v_locked_count + 1;

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

    v_remaining := v_slot.max_capacity - v_slot.booked_count;

    IF v_min_remaining IS NULL OR v_remaining < v_min_remaining THEN
      v_min_remaining := v_remaining;
      v_bottleneck_time := v_slot.start_time;
    END IF;
  END LOOP;

  IF v_locked_count <> v_expected_count THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'MISSING_SLOTS', '必要な空き枠が見つかりません';
    RETURN;
  END IF;

  IF v_min_remaining IS NULL OR v_min_remaining < p_guest_count THEN
    RETURN QUERY
      SELECT NULL::UUID, FALSE, 'CAPACITY_EXCEEDED',
        format(
          '%s の残り枠は %s 名です（%s 名は予約できません）',
          to_char(v_bottleneck_time, 'HH24:MI'),
          GREATEST(COALESCE(v_min_remaining, 0), 0),
          p_guest_count
        );
    RETURN;
  END IF;

  UPDATE availability_slots
  SET booked_count = booked_count + p_guest_count
  WHERE id = ANY (p_affected_slot_ids);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> v_locked_count THEN
    RAISE EXCEPTION 'CAPACITY_EXCEEDED: affected slot update count mismatch (expected %, got %)',
      v_locked_count, v_updated_count
      USING ERRCODE = 'check_violation';
  END IF;

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
    expires_at,
    payment_method
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
    v_status,
    v_expires_at,
    v_payment_method
  )
  RETURNING id INTO v_reservation_id;

  RETURN QUERY SELECT v_reservation_id, TRUE, NULL::TEXT, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION create_reservation_atomic(
  UUID, UUID, UUID, UUID, DATE, TIME, TIME, INT, INT, TIMESTAMPTZ, UUID[], TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_reservation_atomic(
  UUID, UUID, UUID, UUID, DATE, TIME, TIME, INT, INT, TIMESTAMPTZ, UUID[], TEXT
) TO service_role;

COMMENT ON FUNCTION create_reservation_atomic IS
  '予約作成 + 枠確保。online=pending+expires_at, cash_at_venue=confirmed+expires_at NULL';

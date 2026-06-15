-- ============================================================
-- SQL Editor ブロック 2 / 10
-- 003: cancel_reservation_atomic
-- ============================================================

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

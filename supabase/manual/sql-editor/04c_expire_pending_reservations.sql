-- ============================================================
-- SQL Editor ブロック 4c / 10
-- 004: expire_pending_reservations
-- ============================================================

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
      spot_id,
      slot_id,
      plan_id,
      reservation_date,
      guest_count
    FROM reservations
    WHERE status = 'pending'
      AND created_at <= NOW() - INTERVAL '30 minutes'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    v_affected_ids := get_affected_slot_ids_for_reservation(
      v_reservation.spot_id,
      v_reservation.slot_id,
      v_reservation.reservation_date,
      v_reservation.plan_id
    );

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
      AND status = 'pending';

    v_count := v_count + 1;
    v_processed_ids := array_append(v_processed_ids, v_reservation.id);
  END LOOP;

  RETURN QUERY SELECT v_count, v_processed_ids;
END;
$$;

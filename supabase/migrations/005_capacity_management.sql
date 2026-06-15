-- ============================================================
-- 定員管理の明文化 + create_reservation_atomic の容量検証統一
-- 実行順: 5番目（004_expire_pending_reservations.sql の後に実行）
--
-- 方針:
--   - ランタイム定員の唯一のソース: availability_slots.max_capacity
--   - 占有カウンター: availability_slots.booked_count
--   - 在庫判定の唯一の責務: create_reservation_atomic（Checkout では再検証しない）
--   - fishing_spots.capacity はランタイム判定に不使用
--
-- 将来拡張（今回未実装）:
--   sync_spot_capacity(p_spot_id UUID, p_capacity INTEGER, p_from DATE)
--   … fishing_spots.capacity を参照し、p_from 以降の availability_slots.max_capacity を
--     管理画面から一括更新する RPC を追加する想定。
-- ============================================================

-- ------------------------------------------------------------
-- カラム定義の明文化
-- ------------------------------------------------------------
COMMENT ON COLUMN fishing_spots.capacity IS
  '釣り場マスタ定員。availability_slots 生成時のデフォルト参考値。ランタイム予約判定には不使用。将来 sync_spot_capacity(spot_id, capacity, from_date) で未来枠の max_capacity を同期する RPC を追加する想定。';

COMMENT ON COLUMN availability_slots.max_capacity IS
  'hourly スロットの定員上限。remaining_count = min(max_capacity - booked_count) の唯一のソース。';

COMMENT ON COLUMN availability_slots.booked_count IS
  'pending + confirmed の合計占有数。create_reservation_atomic で増加、expired/cancelled で減算。';

-- ------------------------------------------------------------
-- 管理・監査用ビュー（在庫可視化）
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW slot_capacity_status AS
SELECT
  s.id,
  s.spot_id,
  s.slot_date,
  s.start_time,
  s.end_time,
  s.status,
  s.max_capacity,
  s.booked_count,
  GREATEST(s.max_capacity - s.booked_count, 0) AS remaining_count
FROM availability_slots s;

COMMENT ON VIEW slot_capacity_status IS
  'hourly スロットの定員・占有・残枠一覧。remaining_count = max_capacity - booked_count（0 未満は 0 に丸め）';

-- ------------------------------------------------------------
-- create_reservation_atomic: 容量検証を min(remaining) に統一
-- （remaining-count.ts の computeRemainingCount と同一定義）
-- 在庫確保・解放の挙動自体は 003 と同一（booked_count 増加 → pending INSERT）
-- ------------------------------------------------------------
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
  v_locked_count INT := 0;
  v_updated_count INT;
  v_remaining INT;
  v_min_remaining INT := NULL;
  v_bottleneck_time TIME := NULL;
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

  -- 影響スロットを id 順で FOR UPDATE 取得し、検証 + remaining_count 算出を同一ループで行う
  -- （集約 SELECT には FOR UPDATE を付けられないため、ロック済み行から plpgsql で MIN を計算）
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

  -- ロック保持中に booked_count を更新（ループ検証済みのため全行更新）
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

COMMENT ON FUNCTION create_reservation_atomic IS
  '予約作成 + 影響スロット booked_count 増加を原子的に実行。在庫判定は本関数のみが責務を持つ。';

-- cancel_reservation_atomic / expire_pending_reservations は 003 / 004 の定義を維持（変更なし）

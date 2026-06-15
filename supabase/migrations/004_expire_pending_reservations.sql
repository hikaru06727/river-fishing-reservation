-- ============================================================
-- pending 予約の自動失効（30分経過 → expired + 空き枠解放）
-- 実行順: 4番目（003_atomic_reservation_rpc.sql の後に実行）
--
-- 前提:
--   - reservations.status に 'expired' が定義済み（001_initial_schema.sql）
--   - pg_cron 拡張は Supabase Dashboard で事前に有効化すること
-- ============================================================

-- ------------------------------------------------------------
-- インデックス: Cron が pending 行を素早く特定するため
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reservations_pending_created_at
  ON reservations (created_at)
  WHERE status = 'pending';

COMMENT ON INDEX idx_reservations_pending_created_at IS
  'expire_pending_reservations が 30 分経過 pending を検索するための部分インデックス';

-- ------------------------------------------------------------
-- ヘルパー: 予約 1 件に紐づく影響スロット ID 一覧
-- （アプリ側 getAffectedSlotStartTimes と同等の hourly 連続枠）
-- ------------------------------------------------------------
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
  -- 開始スロットの開始時刻を取得
  SELECT start_time
  INTO v_start_time
  FROM availability_slots
  WHERE id = p_slot_id
    AND spot_id = p_spot_id;

  IF NOT FOUND THEN
    RETURN v_ids;
  END IF;

  -- プランの利用時間（分）を取得
  SELECT duration_minutes
  INTO v_duration_minutes
  FROM plans
  WHERE id = p_plan_id;

  IF NOT FOUND OR v_duration_minutes IS NULL OR v_duration_minutes < 60 THEN
    RETURN v_ids;
  END IF;

  v_hour_count := v_duration_minutes / 60;

  -- 例: 3h プラン 09:00 開始 → 09:00, 10:00, 11:00
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

COMMENT ON FUNCTION get_affected_slot_ids_for_reservation IS
  '予約の開始スロット + プラン時間から、booked_count 更新対象の hourly スロット ID 配列を返す';

-- ------------------------------------------------------------
-- メイン: pending → expired（30 分経過）+ booked_count 減算
-- cancel_reservation_atomic と同様に空き枠を解放する
-- ------------------------------------------------------------
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
  -- 失効条件（現行）: created_at から 30 分経過
  -- 将来 expires_at ベースへ移行する場合の影響範囲:
  --   - 本 WHERE 句を (expires_at IS NOT NULL AND expires_at <= NOW()) に変更
  --   - idx_reservations_pending_created_at を expires_at 部分インデックスへ差し替え
  --   - reservations.service.ts の expires_at 設定値と Cron 間隔の整合確認
  --   - reservation/confirm UI の決済期限表示（expires_at 参照済み）
  --   - create_reservation_atomic の p_expires_at 引数（003 で保存済み）
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

    -- 影響スロットの booked_count を減算（GREATEST で負数化を防止）
    IF COALESCE(array_length(v_affected_ids, 1), 0) > 0 THEN
      UPDATE availability_slots
      SET booked_count = GREATEST(booked_count - v_reservation.guest_count, 0)
      WHERE id = ANY (v_affected_ids);
    END IF;

    -- ステータスを expired に更新（pending のみ）
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

COMMENT ON FUNCTION expire_pending_reservations IS
  '決済未完了の pending 予約（作成から 30 分経過）を expired にし、占有していた空き枠を解放する。将来は expires_at ベースへの切替を想定（関数内コメント参照）';

REVOKE ALL ON FUNCTION get_affected_slot_ids_for_reservation FROM PUBLIC;
REVOKE ALL ON FUNCTION expire_pending_reservations FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_affected_slot_ids_for_reservation TO postgres, service_role;
GRANT EXECUTE ON FUNCTION expire_pending_reservations TO postgres, service_role;

-- ------------------------------------------------------------
-- pg_cron ジョブ登録
-- 5 分間隔で実行（30 分 TTL に対し最大約 5 分の処理遅延）
--
-- ※ pg_cron 未有効化時は NOTICE のみ出して migration を継続
-- ------------------------------------------------------------
DO $do$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is not enabled. Enable it in Supabase Dashboard > Database > Extensions, then run: SELECT cron.schedule(''expire-pending-reservations'', ''*/5 * * * *'', $$SELECT expire_pending_reservations()$$);';
    RETURN;
  END IF;

  -- 再適用時の重複登録を防ぐ
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'expire-pending-reservations';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'expire-pending-reservations',
    '*/5 * * * *',
    $$SELECT expire_pending_reservations()$$
  );
END;
$do$;

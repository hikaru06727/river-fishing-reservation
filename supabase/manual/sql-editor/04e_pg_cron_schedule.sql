-- ============================================================
-- SQL Editor ブロック 4e / 10
-- 004: pg_cron ジョブ登録（任意）
--
-- 前提: Dashboard > Database > Extensions で pg_cron を有効化済み
-- 未有効化の場合は NOTICE のみ表示され、失効 Cron は未登録のまま
-- ============================================================

DO $do$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is not enabled. Enable it in Supabase Dashboard > Database > Extensions, then run this script again.';
    RETURN;
  END IF;

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

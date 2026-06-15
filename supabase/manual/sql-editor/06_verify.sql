-- ============================================================
-- SQL Editor ブロック 6 / 10
-- 実行後の確認 SQL
-- ============================================================

-- 1) RPC 関数の存在確認
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_reservation_atomic',
    'cancel_reservation_atomic',
    'expire_pending_reservations',
    'get_affected_slot_ids_for_reservation'
  )
ORDER BY routine_name;

-- 2) service_role への EXECUTE 権限確認
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_reservation_atomic',
    'cancel_reservation_atomic',
    'expire_pending_reservations',
    'get_affected_slot_ids_for_reservation'
  )
  AND grantee IN ('service_role', 'postgres')
ORDER BY routine_name, grantee;

-- 3) 部分インデックス確認
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_reservations_pending_created_at';

-- 4) slot_capacity_status ビュー確認
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'slot_capacity_status';

-- 5) pg_cron ジョブ確認（拡張有効時のみ行が返る）
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'expire-pending-reservations';

-- 6) create_reservation_atomic のドライラン（ダミー UUID → エラー応答で関数到達を確認）
SELECT *
FROM create_reservation_atomic(
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid,
  '2099-01-01'::date,
  '09:00:00'::time,
  '10:00:00'::time,
  1,
  1000,
  NOW() + INTERVAL '30 minutes',
  ARRAY['00000000-0000-0000-0000-000000000004'::uuid]
);
-- 期待: success = false, error_code = 'MISSING_SLOTS' など（関数が呼べれば OK）

-- 008d: 008 適用後の検証クエリ
-- 前提: 008a → 008b → 008c 実行済み

-- 1. payment_method カラム
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'reservations'
  AND column_name = 'payment_method';

-- 2. CHECK 制約
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.reservations'::regclass
  AND conname LIKE '%payment_method%';

-- 3. create_reservation_atomic の引数（p_payment_method 含む）
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'create_reservation_atomic';

-- 4. 既存予約は online（DEFAULT 適用確認）
SELECT payment_method, COUNT(*) AS cnt
FROM reservations
GROUP BY payment_method
ORDER BY payment_method;

-- 5. expire 関数定義に payment_method = 'online' が含まれるか
SELECT pg_get_functiondef(p.oid) LIKE '%payment_method = ''online''%' AS expire_filters_online_only
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'expire_pending_reservations';

-- 6. cash_at_venue が expire 対象に含まれないこと（confirmed なので pending ループに入らない）
--    手動確認: cash 予約は status=confirmed, expires_at IS NULL

-- Phase 8c: backfill 前後の確認用 SQL（Supabase SQL Editor で実行）
-- migration 011 適用前後にそれぞれ実行してください。

-- 1. backfill 前: snapshot カラムの NULL 件数
SELECT
  COUNT(*) FILTER (WHERE reserved_plan_name IS NULL) AS null_plan_name,
  COUNT(*) FILTER (WHERE reserved_unit_price_yen IS NULL) AS null_unit_price,
  COUNT(*) FILTER (WHERE reserved_duration_minutes IS NULL) AS null_duration,
  COUNT(*) AS total_reservations
FROM reservations;

-- 2. backfill 後: NULL 件数（理想はすべて 0）
SELECT
  COUNT(*) FILTER (WHERE reserved_plan_name IS NULL) AS null_plan_name,
  COUNT(*) FILTER (WHERE reserved_unit_price_yen IS NULL) AS null_unit_price,
  COUNT(*) FILTER (WHERE reserved_duration_minutes IS NULL) AS null_duration
FROM reservations;

-- 3. 単価 × 人数 と total_amount_yen の差分（plans 存在行）
SELECT
  r.id,
  r.guest_count,
  r.total_amount_yen,
  r.reserved_unit_price_yen,
  r.reserved_unit_price_yen * r.guest_count AS computed_total,
  r.total_amount_yen - (r.reserved_unit_price_yen * r.guest_count) AS diff_yen
FROM reservations r
INNER JOIN plans p ON p.id = r.plan_id
WHERE r.reserved_unit_price_yen IS NOT NULL
  AND r.total_amount_yen <> r.reserved_unit_price_yen * r.guest_count;

-- 4. duration が 0 以下になっていないか
SELECT id, reserved_duration_minutes, start_time, end_time
FROM reservations
WHERE reserved_duration_minutes IS NOT NULL
  AND reserved_duration_minutes <= 0;

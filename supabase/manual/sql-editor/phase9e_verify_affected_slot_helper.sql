-- Phase 9e: get_affected_slot_ids_for_reservation 簡易検証（ローカル dev / sql-editor 用）
-- 前提: supabase db reset --local 済み

-- 1) seed の legacy hourly 2h 予約 → 2 枠
SELECT COALESCE(
  array_length(
    get_affected_slot_ids_for_reservation('22222222-2222-4222-8222-222222222222'),
    1
  ),
  0
) AS legacy_2h_count;

-- 2) 15分 grid 09:15 / 2h 予約を seed ユーザーで挿入 → 8 枠
INSERT INTO reservations (
  id,
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
  payment_method,
  reserved_plan_name,
  reserved_unit_price_yen,
  reserved_duration_minutes
)
SELECT
  'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
  '44444444-4444-4444-8444-444444444444',
  fs.id,
  p.id,
  s.id,
  s.slot_date,
  '09:15:00'::TIME,
  '11:15:00'::TIME,
  1,
  6000,
  'pending',
  'online',
  'Phase9e 15min 2h',
  6000,
  120
FROM fishing_spots fs
INNER JOIN plans p ON p.slug = '1h' AND p.fishing_spot_id IS NULL
INNER JOIN availability_slots s
  ON s.spot_id = fs.id
 AND s.slot_date = CURRENT_DATE + 7
 AND s.start_time = '09:15:00'::TIME
WHERE fs.slug = 'seiryu-keikoku'
ON CONFLICT (id) DO UPDATE SET
  slot_id = EXCLUDED.slot_id,
  reserved_duration_minutes = EXCLUDED.reserved_duration_minutes;

SELECT COALESCE(
  array_length(
    get_affected_slot_ids_for_reservation('aaaaaaaa-aaaa-4aaa-8aaa-000000000002'),
    1
  ),
  0
) AS fifteen_2h_count;

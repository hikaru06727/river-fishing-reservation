-- ============================================================
-- 川釣り予約サービス — 初期データ（ローカル開発用）
-- supabase db reset / seed 実行時に適用
-- ============================================================

-- ------------------------------------------------------------
-- plans（共通 legacy 1h / 3h）
-- migration 010 以降: slug 単独 UNIQUE ではなく partial unique
--   → ON CONFLICT (slug) WHERE fishing_spot_id IS NULL
-- ------------------------------------------------------------
INSERT INTO plans (name, slug, duration_minutes, price_yen, fishing_spot_id) VALUES
  ('1時間プラン', '1h',  60,  3000, NULL),
  ('3時間プラン', '3h', 180,  8000, NULL)
ON CONFLICT (slug) WHERE (fishing_spot_id IS NULL) DO NOTHING;

-- ------------------------------------------------------------
-- fishing_spots（釣り場）
-- businesses 紐づけは migration 006 で実施済み
-- ------------------------------------------------------------
INSERT INTO fishing_spots (name, slug, description, address, prefecture, capacity) VALUES
  (
    '清流渓谷フィッシング',
    'seiryu-keikoku',
    '透明度の高い渓流でヤマメ・イワナが楽しめる人気の釣り場です。初心者向けのエリアも完備。',
    '長野県木曽郡木曽町',
    '長野県',
    10
  ),
  (
    '奥多摩川フィッシングパーク',
    'okutama',
    '都心からアクセス良好。初心者から上級者まで楽しめる川釣りスポット。アマゴ・イワナが主力。',
    '東京都青梅市',
    '東京都',
    15
  )
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- 釣り場別プラン（Phase 8 検証用: 1h / 2h）
-- ------------------------------------------------------------
INSERT INTO plans (name, slug, duration_minutes, price_yen, fishing_spot_id, max_guests)
SELECT
  '渓谷1時間プラン',
  'seiryu-1h',
  60,
  3200,
  fs.id,
  4
FROM fishing_spots fs
WHERE fs.slug = 'seiryu-keikoku'
ON CONFLICT (fishing_spot_id, slug) WHERE (fishing_spot_id IS NOT NULL) DO NOTHING;

INSERT INTO plans (name, slug, duration_minutes, price_yen, fishing_spot_id, max_guests)
SELECT
  '渓谷2時間プラン',
  'seiryu-2h',
  120,
  5500,
  fs.id,
  4
FROM fishing_spots fs
WHERE fs.slug = 'seiryu-keikoku'
ON CONFLICT (fishing_spot_id, slug) WHERE (fishing_spot_id IS NOT NULL) DO NOTHING;

-- ------------------------------------------------------------
-- availability_slots（今後7日分の空き枠サンプル）
-- ------------------------------------------------------------
INSERT INTO availability_slots (spot_id, slot_date, start_time, end_time, max_capacity, status)
SELECT
  fs.id,
  d.slot_date,
  t.start_time,
  t.end_time,
  5,
  'open'
FROM fishing_spots fs
CROSS JOIN (
  SELECT (CURRENT_DATE + i)::DATE AS slot_date
  FROM generate_series(0, 6) AS i
) d
CROSS JOIN (
  VALUES
    ('06:00'::TIME, '07:00'::TIME),
    ('07:00'::TIME, '08:00'::TIME),
    ('08:00'::TIME, '09:00'::TIME),
    ('09:00'::TIME, '10:00'::TIME),
    ('10:00'::TIME, '11:00'::TIME),
    ('11:00'::TIME, '12:00'::TIME),
    ('13:00'::TIME, '14:00'::TIME),
    ('14:00'::TIME, '15:00'::TIME),
    ('15:00'::TIME, '16:00'::TIME),
    ('16:00'::TIME, '17:00'::TIME),
    ('17:00'::TIME, '18:00'::TIME)
) AS t(start_time, end_time)
WHERE fs.slug IN ('seiryu-keikoku', 'okutama')
ON CONFLICT (spot_id, slot_date, start_time) DO NOTHING;

-- ------------------------------------------------------------
-- Phase 8c 実データ検証用（ローカル dev のみ）
-- 固定 UUID で再実行時も ON CONFLICT DO NOTHING
-- ------------------------------------------------------------
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '44444444-4444-4444-8444-444444444444',
  'authenticated',
  'authenticated',
  'seed.test@example.local',
  extensions.crypt('seedpassword', extensions.gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Seed Test User"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

UPDATE profiles
SET full_name = 'Seed Test User'
WHERE id = '44444444-4444-4444-8444-444444444444';

-- 共通 1h プラン予約（snapshot 付き）
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
  expires_at,
  reserved_plan_name,
  reserved_unit_price_yen,
  reserved_duration_minutes
)
SELECT
  '11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444444',
  fs.id,
  p.id,
  s.id,
  s.slot_date,
  s.start_time,
  '10:00:00'::TIME,
  2,
  6000,
  'confirmed',
  'cash_at_venue',
  NULL,
  '1時間プラン',
  3000,
  60
FROM fishing_spots fs
INNER JOIN plans p ON p.slug = '1h' AND p.fishing_spot_id IS NULL
INNER JOIN availability_slots s
  ON s.spot_id = fs.id
 AND s.slot_date = CURRENT_DATE + 1
 AND s.start_time = '09:00:00'::TIME
WHERE fs.slug = 'seiryu-keikoku'
ON CONFLICT (id) DO NOTHING;

-- 釣り場別 2h プラン予約（snapshot 付き）
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
  expires_at,
  reserved_plan_name,
  reserved_unit_price_yen,
  reserved_duration_minutes
)
SELECT
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444',
  fs.id,
  p.id,
  s.id,
  s.slot_date,
  s.start_time,
  '11:00:00'::TIME,
  1,
  5500,
  'pending',
  'online',
  NOW() + INTERVAL '30 minutes',
  '渓谷2時間プラン',
  5500,
  120
FROM fishing_spots fs
INNER JOIN plans p ON p.slug = 'seiryu-2h' AND p.fishing_spot_id = fs.id
INNER JOIN availability_slots s
  ON s.spot_id = fs.id
 AND s.slot_date = CURRENT_DATE + 1
 AND s.start_time = '09:00:00'::TIME
WHERE fs.slug = 'seiryu-keikoku'
ON CONFLICT (id) DO NOTHING;

-- backfill 検証用: snapshot 未設定の legacy 予約（011 backfill SQL 対象）
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
  expires_at
)
SELECT
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  fs.id,
  p.id,
  s.id,
  s.slot_date,
  s.start_time,
  '10:00:00'::TIME,
  1,
  3200,
  'confirmed',
  'cash_at_venue',
  NULL
FROM fishing_spots fs
INNER JOIN plans p ON p.slug = 'seiryu-1h' AND p.fishing_spot_id = fs.id
INNER JOIN availability_slots s
  ON s.spot_id = fs.id
 AND s.slot_date = CURRENT_DATE + 2
 AND s.start_time = '10:00:00'::TIME
WHERE fs.slug = 'seiryu-keikoku'
ON CONFLICT (id) DO NOTHING;

-- 011 backfill（snapshot 未設定行のみ）
UPDATE reservations r
SET
  reserved_plan_name = COALESCE(r.reserved_plan_name, p.name),
  reserved_unit_price_yen = COALESCE(r.reserved_unit_price_yen, p.price_yen),
  reserved_duration_minutes = COALESCE(r.reserved_duration_minutes, p.duration_minutes)
FROM plans p
WHERE p.id = r.plan_id
  AND (
    r.reserved_plan_name IS NULL
    OR r.reserved_unit_price_yen IS NULL
    OR r.reserved_duration_minutes IS NULL
  );

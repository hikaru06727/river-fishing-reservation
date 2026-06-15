-- ============================================================
-- 川釣り予約サービス — 初期データ
-- 実行順: 3番目（001, 002 の後に実行）
-- ============================================================

-- ------------------------------------------------------------
-- plans（1時間 / 3時間プラン）
-- ------------------------------------------------------------
INSERT INTO plans (name, slug, duration_minutes, price_yen) VALUES
  ('1時間プラン', '1h',  60,  3000),
  ('3時間プラン', '3h', 180,  8000)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- fishing_spots（釣り場）
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
-- availability_slots（今後7日分の空き枠サンプル）
-- 各釣り場 × 6:00〜18:00 を1時間刻み
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

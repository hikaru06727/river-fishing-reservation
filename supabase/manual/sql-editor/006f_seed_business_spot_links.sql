-- SQL Editor 006e: 既存釣り場の事業紐づけ（1 釣り場 = 1 事業）
INSERT INTO businesses (name, slug) VALUES
  ('清流渓谷フィッシング', 'biz-seiryu-keikoku'),
  ('奥多摩川フィッシングパーク', 'biz-okutama')
ON CONFLICT (slug) DO NOTHING;

UPDATE fishing_spots fs
SET business_id = b.id
FROM businesses b
WHERE fs.slug = 'seiryu-keikoku'
  AND b.slug = 'biz-seiryu-keikoku'
  AND fs.business_id IS NULL;

UPDATE fishing_spots fs
SET business_id = b.id
FROM businesses b
WHERE fs.slug = 'okutama'
  AND b.slug = 'biz-okutama'
  AND fs.business_id IS NULL;

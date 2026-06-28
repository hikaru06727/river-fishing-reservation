-- ============================================================
-- Migration 047: 既存レコードを payment_ledger にバックフィル
--                + sale_sessions に DELETE 権限を追加（ロールバック用）
--
-- 背景:
--   Phase L-F で payment_ledger への書き込みを開始したが、
--   それ以前に作成された sale_sessions / manual_sales / reservations が
--   payment_ledger に存在しない。
--   バックフィルにより新旧レコードを統一し、締め集計の一貫性を確保する。
--
--   ON CONFLICT DO NOTHING により既存エントリは上書きされない。
-- ============================================================

-- ------------------------------------------------------------
-- 1. sale_sessions に DELETE 権限追加
--    (payment_ledger 書き込み失敗時のロールバックで必要)
-- ------------------------------------------------------------
GRANT DELETE ON sale_sessions TO authenticated;

-- ------------------------------------------------------------
-- 2. sale_sessions → payment_ledger バックフィル
-- ------------------------------------------------------------
INSERT INTO payment_ledger
  (business_id, source_type, source_id, amount, payment_method, status, paid_at)
SELECT
  ss.business_id,
  'pos',
  ss.id,
  ss.total_amount,
  CASE
    WHEN ss.payment_method = 'cash'                          THEN 'cash'
    WHEN ss.payment_method IN ('stripe', 'credit_card')      THEN 'card'
    ELSE 'other'
  END,
  'succeeded',
  ss.sold_at
FROM sale_sessions ss
WHERE NOT EXISTS (
  SELECT 1 FROM payment_ledger pl
  WHERE pl.source_type = 'pos' AND pl.source_id = ss.id
)
ON CONFLICT (source_type, source_id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. manual_sales → payment_ledger バックフィル
--    paid_at は sale_date の JST 正午とする
-- ------------------------------------------------------------
INSERT INTO payment_ledger
  (business_id, source_type, source_id, amount, payment_method, status, paid_at)
SELECT
  ms.business_id,
  'manual',
  ms.id,
  ms.amount_yen,
  CASE
    WHEN ms.payment_method = 'cash'  THEN 'cash'
    WHEN ms.payment_method = 'card'  THEN 'card'
    ELSE 'other'  -- qr, e_money, other → other
  END,
  'succeeded',
  (ms.sale_date || 'T12:00:00+09:00')::TIMESTAMPTZ
FROM manual_sales ms
WHERE NOT EXISTS (
  SELECT 1 FROM payment_ledger pl
  WHERE pl.source_type = 'manual' AND pl.source_id = ms.id
)
ON CONFLICT (source_type, source_id) DO NOTHING;

-- ------------------------------------------------------------
-- 4. 現地現金払い予約（cash_at_venue, confirmed）→ payment_ledger バックフィル
--    paid_at は予約日の JST 正午とする（実際の支払い時刻の近似値）
-- ------------------------------------------------------------
INSERT INTO payment_ledger
  (business_id, source_type, source_id, amount, payment_method, status, paid_at)
SELECT
  l.business_id,
  'reservation',
  r.id,
  r.total_amount_yen,
  'cash',
  'succeeded',
  (r.reservation_date || 'T12:00:00+09:00')::TIMESTAMPTZ
FROM reservations r
JOIN locations l ON r.spot_id = l.id
WHERE r.status = 'confirmed'
  AND (r.payment_method = 'cash_at_venue' OR r.payment_method IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM payment_ledger pl
    WHERE pl.source_type = 'reservation' AND pl.source_id = r.id
  )
ON CONFLICT (source_type, source_id) DO NOTHING;

-- ------------------------------------------------------------
-- 5. オンライン決済済み予約（online, confirmed, payment succeeded）→ バックフィル
--    paid_at は payments.paid_at を優先し、なければ reservations.updated_at
-- ------------------------------------------------------------
INSERT INTO payment_ledger
  (business_id, source_type, source_id, amount, payment_method, status, paid_at)
SELECT
  l.business_id,
  'reservation',
  r.id,
  COALESCE(p.amount_yen, r.total_amount_yen),
  'card',
  'succeeded',
  COALESCE(p.paid_at, r.updated_at)
FROM reservations r
JOIN locations l ON r.spot_id = l.id
JOIN payments p ON p.reservation_id = r.id AND p.status = 'succeeded'
WHERE r.status = 'confirmed'
  AND r.payment_method = 'online'
  AND NOT EXISTS (
    SELECT 1 FROM payment_ledger pl
    WHERE pl.source_type = 'reservation' AND pl.source_id = r.id
  )
ON CONFLICT (source_type, source_id) DO NOTHING;

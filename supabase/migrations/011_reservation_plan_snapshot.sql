-- ============================================================
-- 011: 予約時点のプラン snapshot カラム追加
-- 実行順: 010_spot_plans.sql の後
--
-- Phase 8c: 表示・メール・Stripe 表示名用。
-- cancel/expire RPC の duration 参照は Phase 8d。
-- NOT NULL 化は backfill 確認後に別 migration で検討。
-- ============================================================

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS reserved_plan_name TEXT,
  ADD COLUMN IF NOT EXISTS reserved_unit_price_yen INT,
  ADD COLUMN IF NOT EXISTS reserved_duration_minutes INT;

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_reserved_unit_price_yen_check,
  ADD CONSTRAINT reservations_reserved_unit_price_yen_check
    CHECK (reserved_unit_price_yen IS NULL OR reserved_unit_price_yen >= 0);

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_reserved_duration_minutes_check,
  ADD CONSTRAINT reservations_reserved_duration_minutes_check
    CHECK (reserved_duration_minutes IS NULL OR reserved_duration_minutes > 0);

COMMENT ON COLUMN reservations.reserved_plan_name IS
  '予約作成時点のプラン名（表示・メール用スナップショット）';

COMMENT ON COLUMN reservations.reserved_unit_price_yen IS
  '予約作成時点の1名あたり単価';

COMMENT ON COLUMN reservations.reserved_duration_minutes IS
  '予約作成時点の利用時間（分）。cancel/expire RPC は Phase 8d で参照';

-- ------------------------------------------------------------
-- Backfill: plans が存在する既存予約
-- 適用前に docs/phase-8c-backfill-verification.sql の確認 SELECT を実行すること
-- ------------------------------------------------------------
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

-- Backfill: plan が欠落している孤立 reservation
UPDATE reservations r
SET
  reserved_plan_name = COALESCE(r.reserved_plan_name, '（削除済みプラン）'),
  reserved_unit_price_yen = COALESCE(
    r.reserved_unit_price_yen,
    CASE
      WHEN r.guest_count > 0 THEN r.total_amount_yen / r.guest_count
      ELSE NULL
    END
  ),
  reserved_duration_minutes = COALESCE(
    r.reserved_duration_minutes,
    GREATEST(EXTRACT(EPOCH FROM (r.end_time - r.start_time)) / 60, 0)::INT
  )
WHERE NOT EXISTS (SELECT 1 FROM plans p WHERE p.id = r.plan_id)
  AND (
    r.reserved_plan_name IS NULL
    OR r.reserved_unit_price_yen IS NULL
    OR r.reserved_duration_minutes IS NULL
  );

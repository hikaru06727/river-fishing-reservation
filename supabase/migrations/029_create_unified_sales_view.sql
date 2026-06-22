-- ============================================================
-- Migration 029: unified_sales ビュー作成
--
-- 確定済み予約売上と手動売上を統合して表示する VIEW。
-- SECURITY INVOKER により呼び出し元ユーザーの RLS が適用される。
-- ============================================================

CREATE OR REPLACE VIEW unified_sales
WITH (security_invoker = true)
AS
  -- 確定済み予約売上
  SELECT
    r.id,
    l.business_id,
    r.spot_id                AS location_id,
    r.reservation_date       AS sale_date,
    r.total_amount_yen       AS amount_yen,
    r.tax_rate_percent,
    'reservation'::TEXT      AS sale_type,
    r.payment_method::TEXT   AS payment_method,
    NULL::TEXT               AS category,
    r.created_at
  FROM reservations r
  JOIN locations l ON l.id = r.spot_id
  WHERE r.status = 'confirmed'

  UNION ALL

  -- 手動売上
  SELECT
    ms.id,
    ms.business_id,
    ms.location_id,
    ms.sale_date,
    ms.amount_yen,
    ms.tax_rate_percent,
    'manual'::TEXT           AS sale_type,
    ms.payment_method,
    ms.category,
    ms.created_at
  FROM manual_sales ms;

COMMENT ON VIEW unified_sales IS
  '確定済み予約売上と手動売上の統合ビュー。RLS は呼び出し元ユーザーに基づいて適用される。';

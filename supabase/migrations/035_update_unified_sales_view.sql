DROP VIEW IF EXISTS unified_sales_view CASCADE;
DROP VIEW IF EXISTS unified_sales CASCADE;

CREATE VIEW unified_sales
WITH (security_invoker = true)
AS
  -- 確定済み予約売上
  SELECT
    r.id,
    l.business_id,
    r.spot_id                AS location_id,
    r.reservation_date       AS sale_date,
    r.total_amount_yen       AS amount_yen,
    r.tax_rate_percent::NUMERIC,
    'reservation'::TEXT      AS sale_type,
    r.payment_method::TEXT   AS payment_method,
    NULL::TEXT               AS category,
    r.created_at
  FROM reservations r
  JOIN locations l ON l.id = r.spot_id
  WHERE r.status = 'confirmed'

  UNION ALL

  SELECT
    ms.id,
    ms.business_id,
    ms.location_id,
    ms.sale_date,
    ms.amount_yen,
    ms.tax_rate_percent::NUMERIC,
    'manual'::TEXT           AS sale_type,
    ms.payment_method,
    ms.category,
    ms.created_at
  FROM manual_sales ms

  UNION ALL

  SELECT
    ps.id,
    ps.business_id,
    NULL::UUID               AS location_id,
    ps.purchased_at::DATE    AS sale_date,
    (ps.quantity * ps.unit_price_excluding_tax) AS amount_yen,
    ps.tax_rate_percent::NUMERIC,
    'product'::TEXT          AS sale_type,
    ps.payment_method,
    p.name                   AS category,
    ps.created_at
  FROM product_sales ps
  JOIN products p ON p.id = ps.product_id
  WHERE ps.status = 'completed'
    AND ps.sale_session_id IS NULL

  UNION ALL

  SELECT
    ss.id,
    ss.business_id,
    NULL::UUID               AS location_id,
    ss.sold_at::DATE         AS sale_date,
    ss.subtotal_amount       AS amount_yen,
    ss.tax_rate_percent::NUMERIC,
    'pos'::TEXT              AS sale_type,
    ss.payment_method,
    NULL::TEXT               AS category,
    ss.created_at
  FROM sale_sessions ss;

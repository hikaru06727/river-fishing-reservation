-- ============================================================
-- Migration 041: staff role RLS policies
-- ============================================================
-- Background: 039 added is_staff() and updated can_manage_business() for staff,
-- but existing RLS policies only allowed is_business_admin(). Staff could not
-- access products, sale sessions, reservations, payments, or profiles.
-- Policy approach: add separate staff policies alongside existing business_admin
-- policies without modifying them.

-- products: staff SELECT for POS product listing
DROP POLICY IF EXISTS "products_staff_select" ON products;
CREATE POLICY "products_staff_select"
  ON products FOR SELECT TO authenticated
  USING (is_staff() AND can_manage_business(business_id));

-- product_sales: staff ALL for POS sale recording
DROP POLICY IF EXISTS "product_sales_staff_all" ON product_sales;
CREATE POLICY "product_sales_staff_all"
  ON product_sales FOR ALL TO authenticated
  USING (is_staff() AND can_manage_business(business_id))
  WITH CHECK (is_staff() AND can_manage_business(business_id));

-- sale_sessions: staff ALL for POS session creation
DROP POLICY IF EXISTS "sale_sessions_staff_all" ON sale_sessions;
CREATE POLICY "sale_sessions_staff_all"
  ON sale_sessions FOR ALL TO authenticated
  USING (is_staff() AND can_manage_business(business_id))
  WITH CHECK (is_staff() AND can_manage_business(business_id));

-- sale_session_items: staff ALL for POS session items
DROP POLICY IF EXISTS "sale_session_items_staff_all" ON sale_session_items;
CREATE POLICY "sale_session_items_staff_all"
  ON sale_session_items FOR ALL TO authenticated
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM sale_sessions ss
      WHERE ss.id = sale_session_id
        AND can_manage_business(ss.business_id)
    )
  )
  WITH CHECK (
    is_staff() AND EXISTS (
      SELECT 1 FROM sale_sessions ss
      WHERE ss.id = sale_session_id
        AND can_manage_business(ss.business_id)
    )
  );

-- reservations: staff SELECT for reservation list and detail
DROP POLICY IF EXISTS "reservations_staff_select" ON reservations;
CREATE POLICY "reservations_staff_select"
  ON reservations FOR SELECT TO authenticated
  USING (is_staff() AND can_manage_location(spot_id));

-- payments: staff SELECT for reservation detail payment display
-- (writes go through createAdminClient / service_role in payments.service.ts)
DROP POLICY IF EXISTS "payments_staff_select" ON payments;
CREATE POLICY "payments_staff_select"
  ON payments FOR SELECT TO authenticated
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id = payments.reservation_id
        AND can_manage_location(r.spot_id)
    )
  );

-- profiles: staff SELECT for reservation detail customer info
DROP POLICY IF EXISTS "profiles_staff_select" ON profiles;
CREATE POLICY "profiles_staff_select"
  ON profiles FOR SELECT TO authenticated
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM reservations r
      INNER JOIN locations l ON l.id = r.spot_id
      WHERE r.user_id = profiles.id
        AND can_manage_business(l.business_id)
    )
  );

-- SQL Editor 006h: RLS ポリシー（businesses / assignments / profiles / spots / slots / reservations / payments）
-- 007 RLS hardening 適用済み・未適用の両方で DROP IF EXISTS により冪等

-- businesses
DROP POLICY IF EXISTS "businesses_admin_all" ON businesses;
CREATE POLICY "businesses_admin_all" ON businesses
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "businesses_business_admin_select" ON businesses;
CREATE POLICY "businesses_business_admin_select" ON businesses
  FOR SELECT TO authenticated USING (can_manage_business(id));

-- business_admin_assignments
DROP POLICY IF EXISTS "business_admin_assignments_admin_all" ON business_admin_assignments;
CREATE POLICY "business_admin_assignments_admin_all" ON business_admin_assignments
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "business_admin_assignments_select_own" ON business_admin_assignments;
CREATE POLICY "business_admin_assignments_select_own" ON business_admin_assignments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- profiles（予約一覧 JOIN）
DROP POLICY IF EXISTS "profiles_business_admin_select" ON profiles;
CREATE POLICY "profiles_business_admin_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    is_business_admin()
    AND EXISTS (
      SELECT 1 FROM reservations r
      INNER JOIN fishing_spots fs ON fs.id = r.spot_id
      WHERE r.user_id = profiles.id AND can_manage_business(fs.business_id)
    )
  );

-- fishing_spots
DROP POLICY IF EXISTS "spots_public_read" ON fishing_spots;
CREATE POLICY "spots_public_read" ON fishing_spots
  FOR SELECT
  USING (
    is_active = TRUE OR is_admin()
    OR (is_business_admin() AND can_manage_spot(id))
  );

-- availability_slots
DROP POLICY IF EXISTS "slots_public_read" ON availability_slots;
CREATE POLICY "slots_public_read" ON availability_slots
  FOR SELECT
  USING (
    status = 'open' OR is_admin()
    OR (is_business_admin() AND can_manage_spot(spot_id))
  );

-- reservations
DROP POLICY IF EXISTS "reservations_select_own" ON reservations;
DROP POLICY IF EXISTS "reservations_insert_own" ON reservations;
DROP POLICY IF EXISTS "reservations_update_own" ON reservations;
DROP POLICY IF EXISTS "reservations_admin_all" ON reservations;
DROP POLICY IF EXISTS "reservations_business_admin_select" ON reservations;

CREATE POLICY "reservations_select_own" ON reservations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "reservations_admin_all" ON reservations
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "reservations_business_admin_select" ON reservations
  FOR SELECT TO authenticated
  USING (is_business_admin() AND can_manage_spot(spot_id));

-- payments
DROP POLICY IF EXISTS "payments_select_own" ON payments;
DROP POLICY IF EXISTS "payments_select_own_reservation" ON payments;
DROP POLICY IF EXISTS "payments_admin_write" ON payments;
DROP POLICY IF EXISTS "payments_admin_all" ON payments;
DROP POLICY IF EXISTS "payments_business_admin_select" ON payments;

CREATE POLICY "payments_select_own_reservation" ON payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id = payments.reservation_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "payments_admin_all" ON payments
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "payments_business_admin_select" ON payments
  FOR SELECT TO authenticated
  USING (
    is_business_admin()
    AND EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id = payments.reservation_id AND can_manage_spot(r.spot_id)
    )
  );

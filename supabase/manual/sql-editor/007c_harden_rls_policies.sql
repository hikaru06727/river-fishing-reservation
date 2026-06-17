-- 007c: RLS ポリシー hardening
-- 前提: 007a, 007b 適用済み

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_select" ON profiles;
CREATE POLICY "profiles_admin_select"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "profiles_business_admin_select" ON profiles;
CREATE POLICY "profiles_business_admin_select"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    is_business_admin()
    AND EXISTS (
      SELECT 1
      FROM reservations r
      INNER JOIN fishing_spots fs ON fs.id = r.spot_id
      WHERE r.user_id = profiles.id
        AND can_manage_business(fs.business_id)
    )
  );

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role IS NOT DISTINCT FROM auth_profile_role()
  );

DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "businesses_admin_all" ON businesses;
CREATE POLICY "businesses_admin_all"
  ON businesses
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "businesses_business_admin_select" ON businesses;
CREATE POLICY "businesses_business_admin_select"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (can_manage_business(id));

DROP POLICY IF EXISTS "business_admin_assignments_admin_all" ON business_admin_assignments;
CREATE POLICY "business_admin_assignments_admin_all"
  ON business_admin_assignments
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "business_admin_assignments_select_own" ON business_admin_assignments;
CREATE POLICY "business_admin_assignments_select_own"
  ON business_admin_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "spots_public_read" ON fishing_spots;
CREATE POLICY "spots_public_read"
  ON fishing_spots
  FOR SELECT
  USING (
    is_active = TRUE
    OR is_admin()
    OR (is_business_admin() AND can_manage_spot(id))
  );

DROP POLICY IF EXISTS "spots_admin_write" ON fishing_spots;
DROP POLICY IF EXISTS "spots_admin_all" ON fishing_spots;
CREATE POLICY "spots_admin_all"
  ON fishing_spots
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "spots_business_admin_update" ON fishing_spots;
CREATE POLICY "spots_business_admin_update"
  ON fishing_spots
  FOR UPDATE
  TO authenticated
  USING (is_business_admin() AND can_manage_spot(id))
  WITH CHECK (is_business_admin() AND can_manage_spot(id));

DROP POLICY IF EXISTS "plans_public_read" ON plans;
CREATE POLICY "plans_public_read"
  ON plans
  FOR SELECT
  USING (is_active = TRUE OR is_admin() OR is_management());

DROP POLICY IF EXISTS "plans_admin_write" ON plans;
DROP POLICY IF EXISTS "plans_admin_all" ON plans;
CREATE POLICY "plans_admin_all"
  ON plans
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "slots_public_read" ON availability_slots;
CREATE POLICY "slots_public_read"
  ON availability_slots
  FOR SELECT
  USING (
    status = 'open'
    OR is_admin()
    OR (is_business_admin() AND can_manage_spot(spot_id))
  );

DROP POLICY IF EXISTS "slots_admin_write" ON availability_slots;
DROP POLICY IF EXISTS "slots_admin_all" ON availability_slots;
CREATE POLICY "slots_admin_all"
  ON availability_slots
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "slots_business_admin_insert" ON availability_slots;
CREATE POLICY "slots_business_admin_insert"
  ON availability_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (is_business_admin() AND can_manage_spot(spot_id));

DROP POLICY IF EXISTS "slots_business_admin_update" ON availability_slots;
CREATE POLICY "slots_business_admin_update"
  ON availability_slots
  FOR UPDATE
  TO authenticated
  USING (is_business_admin() AND can_manage_spot(spot_id))
  WITH CHECK (is_business_admin() AND can_manage_spot(spot_id));

DROP POLICY IF EXISTS "slots_business_admin_delete" ON availability_slots;
CREATE POLICY "slots_business_admin_delete"
  ON availability_slots
  FOR DELETE
  TO authenticated
  USING (is_business_admin() AND can_manage_spot(spot_id));

DROP POLICY IF EXISTS "reservations_select_own" ON reservations;
CREATE POLICY "reservations_select_own"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reservations_admin_all" ON reservations;
DROP POLICY IF EXISTS "reservations_admin_select" ON reservations;
DROP POLICY IF EXISTS "reservations_admin_update" ON reservations;
CREATE POLICY "reservations_admin_select"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "reservations_admin_update"
  ON reservations
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "reservations_business_admin_select" ON reservations;
CREATE POLICY "reservations_business_admin_select"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (
    is_business_admin()
    AND can_manage_spot(spot_id)
  );

DROP POLICY IF EXISTS "reservations_business_admin_update" ON reservations;
CREATE POLICY "reservations_business_admin_update"
  ON reservations
  FOR UPDATE
  TO authenticated
  USING (is_business_admin() AND can_manage_spot(spot_id))
  WITH CHECK (is_business_admin() AND can_manage_spot(spot_id));

DROP POLICY IF EXISTS "payments_select_own" ON payments;
DROP POLICY IF EXISTS "payments_select_own_reservation" ON payments;
CREATE POLICY "payments_select_own_reservation"
  ON payments
  FOR SELECT
  TO authenticated
  USING (owns_reservation(reservation_id));

DROP POLICY IF EXISTS "payments_admin_all" ON payments;
DROP POLICY IF EXISTS "payments_admin_write" ON payments;
DROP POLICY IF EXISTS "payments_admin_select" ON payments;
CREATE POLICY "payments_admin_select"
  ON payments
  FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "payments_business_admin_select" ON payments;
CREATE POLICY "payments_business_admin_select"
  ON payments
  FOR SELECT
  TO authenticated
  USING (
    is_business_admin()
    AND EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.id = payments.reservation_id
        AND can_manage_spot(r.spot_id)
    )
  );

DROP POLICY IF EXISTS "catches_public_read" ON catch_reports;
CREATE POLICY "catches_public_read"
  ON catch_reports
  FOR SELECT
  USING (status = 'published' OR is_admin() OR is_management());

DROP POLICY IF EXISTS "catches_admin_write" ON catch_reports;
DROP POLICY IF EXISTS "catches_admin_all" ON catch_reports;
CREATE POLICY "catches_admin_all"
  ON catch_reports
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "blog_public_read" ON blog_posts;
CREATE POLICY "blog_public_read"
  ON blog_posts
  FOR SELECT
  USING (status = 'published' OR is_admin() OR is_management());

DROP POLICY IF EXISTS "blog_admin_write" ON blog_posts;
DROP POLICY IF EXISTS "blog_admin_all" ON blog_posts;
CREATE POLICY "blog_admin_all"
  ON blog_posts
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 川釣り予約サービス — Row Level Security (RLS)
-- 実行順: 2番目（001_initial_schema.sql の後に実行）
-- ============================================================

-- RLS 有効化
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fishing_spots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE catch_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts         ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- ヘルパー関数: 管理者判定
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT
  USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id OR is_admin());

-- ------------------------------------------------------------
-- fishing_spots
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "spots_public_read" ON fishing_spots;
CREATE POLICY "spots_public_read" ON fishing_spots
  FOR SELECT
  USING (is_active = TRUE OR is_admin());

DROP POLICY IF EXISTS "spots_admin_write" ON fishing_spots;
CREATE POLICY "spots_admin_write" ON fishing_spots
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ------------------------------------------------------------
-- plans
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "plans_public_read" ON plans;
CREATE POLICY "plans_public_read" ON plans
  FOR SELECT
  USING (is_active = TRUE OR is_admin());

DROP POLICY IF EXISTS "plans_admin_write" ON plans;
CREATE POLICY "plans_admin_write" ON plans
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ------------------------------------------------------------
-- availability_slots
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "slots_public_read" ON availability_slots;
CREATE POLICY "slots_public_read" ON availability_slots
  FOR SELECT
  USING (status = 'open' OR is_admin());

DROP POLICY IF EXISTS "slots_admin_write" ON availability_slots;
CREATE POLICY "slots_admin_write" ON availability_slots
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ------------------------------------------------------------
-- reservations
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "reservations_select_own" ON reservations;
CREATE POLICY "reservations_select_own" ON reservations
  FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "reservations_insert_own" ON reservations;
CREATE POLICY "reservations_insert_own" ON reservations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reservations_update_own" ON reservations;
CREATE POLICY "reservations_update_own" ON reservations
  FOR UPDATE
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

-- ------------------------------------------------------------
-- payments
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "payments_select_own" ON payments;
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.id = payments.reservation_id
        AND (r.user_id = auth.uid() OR is_admin())
    )
  );

DROP POLICY IF EXISTS "payments_admin_write" ON payments;
CREATE POLICY "payments_admin_write" ON payments
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ------------------------------------------------------------
-- catch_reports
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "catches_public_read" ON catch_reports;
CREATE POLICY "catches_public_read" ON catch_reports
  FOR SELECT
  USING (status = 'published' OR is_admin());

DROP POLICY IF EXISTS "catches_admin_write" ON catch_reports;
CREATE POLICY "catches_admin_write" ON catch_reports
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ------------------------------------------------------------
-- blog_posts
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "blog_public_read" ON blog_posts;
CREATE POLICY "blog_public_read" ON blog_posts
  FOR SELECT
  USING (status = 'published' OR is_admin());

DROP POLICY IF EXISTS "blog_admin_write" ON blog_posts;
CREATE POLICY "blog_admin_write" ON blog_posts
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 007: RLS hardening（本番運用向け）
-- 実行順: 007（006_business_admin_rls.sql の後）
--
-- 方針:
--   - 予約作成/キャンセル/失効は RPC + service_role（RLS バイパス）のまま維持
--   - Stripe webhook / メール通知も service_role 経由のため影響なし
--   - authenticated クライアントからの直接 INSERT/UPDATE は最小限に制限
--   - role 変更は admin / service_role のみ
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper 関数の hardening（search_path 明示）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION auth_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM profiles
  WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION auth_profile_role() IS 'RLS WITH CHECK 用: 更新前の自分の role を取得';

CREATE OR REPLACE FUNCTION owns_reservation(p_reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM reservations r
    WHERE r.id = p_reservation_id
      AND r.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION owns_reservation(UUID) IS '認証ユーザーが予約の所有者か';

-- is_business_admin / is_management / can_manage_* は 006 で定義済み（再定義で search_path を保証）
CREATE OR REPLACE FUNCTION is_business_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'business_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_management()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin() OR is_business_admin();
$$;

CREATE OR REPLACE FUNCTION can_manage_business(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN is_admin() THEN TRUE
    WHEN p_business_id IS NULL THEN FALSE
    WHEN is_business_admin() THEN EXISTS (
      SELECT 1
      FROM business_admin_assignments ba
      WHERE ba.user_id = auth.uid()
        AND ba.business_id = p_business_id
    )
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION can_manage_spot(p_spot_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN is_admin() THEN TRUE
    WHEN p_spot_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM fishing_spots fs
      WHERE fs.id = p_spot_id
        AND can_manage_business(fs.business_id)
    )
  END;
$$;

-- ------------------------------------------------------------
-- 2. profiles: role 変更防止トリガー + RLS 再定義
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_profile_role_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    -- service_role / バックエンド（JWT ユーザーコンテキストなし）
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    IF is_admin() THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'profile role cannot be changed by client'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_role_immutability ON profiles;
CREATE TRIGGER enforce_profile_role_immutability
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_profile_role_immutability();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

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

-- 006 の business_admin 用 SELECT（予約 JOIN 用）を維持・再作成
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

-- INSERT / DELETE は auth trigger + service_role のみ（クライアント不可）

-- ------------------------------------------------------------
-- 3. businesses / business_admin_assignments（006 維持 + 明示再作成）
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 4. fishing_spots
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 5. plans（公開 read + admin write のみ）
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 6. availability_slots
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 7. reservations
--    作成/キャンセル/失効は RPC (service_role) のみ。直接 INSERT/UPDATE 不可。
-- ------------------------------------------------------------
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

-- reservations_insert_own / reservations_update_own は意図的に作らない（006 方針維持）
-- DELETE は全ロール禁止（service_role のみ）

-- ------------------------------------------------------------
-- 8. payments（SELECT のみ。書き込みは webhook / service_role）
-- ------------------------------------------------------------
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

-- INSERT / UPDATE / DELETE ポリシーなし → authenticated からは不可

-- ------------------------------------------------------------
-- 9. catch_reports / blog_posts（管理系は admin のみ）
-- ------------------------------------------------------------
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

COMMENT ON POLICY "reservations_select_own" ON reservations IS
  '一般ユーザーは自分の予約のみ SELECT。作成/更新は RPC 経由。';

COMMENT ON POLICY "payments_select_own_reservation" ON payments IS
  '一般ユーザーは自分の予約の決済のみ SELECT。書き込みは Stripe webhook (service_role)。';

-- ============================================================
-- 006: 事業 (businesses) + business_admin + RLS 拡張
-- 実行順: 006（005_capacity_management.sql の後）
--
-- 前提:
--   - 001〜005 適用済み
--   - 007 RLS hardening 適用済み想定（未適用でも DROP IF EXISTS で冪等）
-- ============================================================

-- ------------------------------------------------------------
-- 1. businesses テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS businesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE businesses IS '事業（運営単位）。fishing_spots の親。';

DROP TRIGGER IF EXISTS businesses_updated_at ON businesses;
CREATE TRIGGER businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 2. fishing_spots.business_id（既存データ互換のため nullable）
-- ------------------------------------------------------------
ALTER TABLE fishing_spots
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fishing_spots_business_id
  ON fishing_spots (business_id);

COMMENT ON COLUMN fishing_spots.business_id IS '所属事業。business_admin のスコープ判定に使用。';

-- ------------------------------------------------------------
-- 3. business_admin_assignments（多対多）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_admin_assignments (
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_business_admin_assignments_business_id
  ON business_admin_assignments (business_id);

COMMENT ON TABLE business_admin_assignments IS '事業管理者の担当事業割当';

-- ------------------------------------------------------------
-- 4. profiles.role に business_admin を追加
-- ------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'business_admin'));

-- ------------------------------------------------------------
-- 5. 既存釣り場の初期事業紐づけ（1 釣り場 = 1 事業）
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 6. RLS helper 関数
-- ------------------------------------------------------------
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

COMMENT ON FUNCTION is_business_admin() IS 'profiles.role = business_admin';
COMMENT ON FUNCTION is_management() IS 'admin または business_admin';
COMMENT ON FUNCTION can_manage_business(UUID) IS 'admin は全事業、business_admin は割当事業のみ';
COMMENT ON FUNCTION can_manage_spot(UUID) IS 'admin は全 spot、business_admin は担当事業の spot のみ';

-- ------------------------------------------------------------
-- 7. 新テーブル RLS
-- ------------------------------------------------------------
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_admin_assignments ENABLE ROW LEVEL SECURITY;

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
-- 8. profiles RLS 拡張（予約一覧 JOIN 用）
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 9. fishing_spots RLS 拡張
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

-- spots_admin_write は admin のみ維持（002 相当）

-- ------------------------------------------------------------
-- 10. availability_slots RLS 拡張
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

-- ------------------------------------------------------------
-- 11. reservations RLS（007 hardening 互換 + business_admin SELECT）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "reservations_select_own" ON reservations;
DROP POLICY IF EXISTS "reservations_insert_own" ON reservations;
DROP POLICY IF EXISTS "reservations_update_own" ON reservations;
DROP POLICY IF EXISTS "reservations_admin_all" ON reservations;
DROP POLICY IF EXISTS "reservations_business_admin_select" ON reservations;

CREATE POLICY "reservations_select_own"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "reservations_admin_all"
  ON reservations
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "reservations_business_admin_select"
  ON reservations
  FOR SELECT
  TO authenticated
  USING (
    is_business_admin()
    AND can_manage_spot(spot_id)
  );

-- 一般ユーザーの INSERT/UPDATE ポリシーは意図的に作らない（RPC / service_role 経由）

-- ------------------------------------------------------------
-- 12. payments RLS 拡張
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "payments_select_own" ON payments;
DROP POLICY IF EXISTS "payments_select_own_reservation" ON payments;
DROP POLICY IF EXISTS "payments_admin_write" ON payments;
DROP POLICY IF EXISTS "payments_admin_all" ON payments;
DROP POLICY IF EXISTS "payments_business_admin_select" ON payments;

CREATE POLICY "payments_select_own_reservation"
  ON payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.id = payments.reservation_id
        AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "payments_admin_all"
  ON payments
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

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

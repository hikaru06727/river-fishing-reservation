-- ============================================================
-- Migration 039: staffロール基盤（Phase L-A）
--
-- 変更内容:
--   1. profiles.role に 'staff' を追加
--   2. staff_members テーブル作成
--   3. is_staff() SQL関数追加
--   4. is_management() に is_staff() を追加
--   5. can_manage_business() にスタッフ割当チェックを追加
--   6. staff_members RLS ポリシー設定
--   7. 権限付与（GRANT）
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles.role に 'staff' を追加
-- ------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'business_admin', 'staff'));

-- ------------------------------------------------------------
-- 2. staff_members テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT NOT NULL,
  name        TEXT,
  role        TEXT NOT NULL DEFAULT 'staff',
  status      TEXT NOT NULL DEFAULT 'invited'
                CHECK (status IN ('invited', 'active', 'disabled')),
  invited_at  TIMESTAMPTZ DEFAULT now(),
  joined_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, email)
);

CREATE INDEX IF NOT EXISTS idx_staff_members_business_id ON staff_members (business_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_user_id     ON staff_members (user_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_email       ON staff_members (email);

COMMENT ON TABLE staff_members IS 'スタッフ招待・管理テーブル（Phase L-A）';

-- ------------------------------------------------------------
-- 3. is_staff() — profiles.role = 'staff' を確認
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_staff()
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
      AND role = 'staff'
  );
$$;

COMMENT ON FUNCTION is_staff() IS 'profiles.role = staff かつ認証済み';

-- ------------------------------------------------------------
-- 4. is_management() — staff を追加
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_management()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin() OR is_business_admin() OR is_staff();
$$;

COMMENT ON FUNCTION is_management() IS 'admin / business_admin / staff のいずれか';

-- ------------------------------------------------------------
-- 5. can_manage_business() — staff の business_id チェックを追加
-- ------------------------------------------------------------
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
    WHEN is_staff() THEN EXISTS (
      SELECT 1
      FROM staff_members sm
      WHERE sm.user_id = auth.uid()
        AND sm.business_id = p_business_id
        AND sm.status = 'active'
    )
    ELSE FALSE
  END;
$$;

COMMENT ON FUNCTION can_manage_business(UUID) IS 'admin=全事業, business_admin=割当事業, staff=所属事業（active のみ）';

-- ------------------------------------------------------------
-- 6. staff_members RLS
-- ------------------------------------------------------------
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- admin は全件操作可
DROP POLICY IF EXISTS "staff_members_admin_all" ON staff_members;
CREATE POLICY "staff_members_admin_all"
  ON staff_members
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin は担当事業のスタッフを管理可
DROP POLICY IF EXISTS "staff_members_business_admin_all" ON staff_members;
CREATE POLICY "staff_members_business_admin_all"
  ON staff_members
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

-- staff は自分のレコードのみ閲覧可
DROP POLICY IF EXISTS "staff_members_select_own" ON staff_members;
CREATE POLICY "staff_members_select_own"
  ON staff_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- 7. GRANT
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON staff_members TO authenticated;

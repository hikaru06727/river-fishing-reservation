-- 007a: RLS helper 関数 hardening
-- 実行順: 007a → 007b → 007c

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

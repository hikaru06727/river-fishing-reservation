-- SQL Editor 006g: RLS helper 関数
CREATE OR REPLACE FUNCTION is_business_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'business_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_management()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT is_admin() OR is_business_admin();
$$;

CREATE OR REPLACE FUNCTION can_manage_business(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN is_admin() THEN TRUE
    WHEN p_business_id IS NULL THEN FALSE
    WHEN is_business_admin() THEN EXISTS (
      SELECT 1 FROM business_admin_assignments ba
      WHERE ba.user_id = auth.uid() AND ba.business_id = p_business_id
    )
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION can_manage_spot(p_spot_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN is_admin() THEN TRUE
    WHEN p_spot_id IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1 FROM fishing_spots fs
      WHERE fs.id = p_spot_id AND can_manage_business(fs.business_id)
    )
  END;
$$;

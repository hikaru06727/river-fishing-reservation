-- ============================================================
-- Migration 046: can_manage_business() に staff ブランチを再確定
--
-- 経緯:
--   migration 006 が staff ブランチを持たない古い can_manage_business() を定義している。
--   migration 039 で staff ブランチを追加したが、リモートへのプッシュ順序の問題で
--   039 → 006 の順に適用されると 006 が staff ブランチを上書きしてしまう。
--   本 migration でスタッフ対応版を確定し、以後は冪等に維持する。
-- ============================================================

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

COMMENT ON FUNCTION can_manage_business(UUID)
  IS 'admin=全事業, business_admin=割当事業, staff=所属事業（active のみ）（Phase L-A 修正: migration 046）';

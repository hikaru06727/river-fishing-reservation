-- ============================================================
-- Migration 036: sale_sessions / sale_session_items RLS ポリシー追加
--
-- 背景:
--   034 で RLS は有効化したがポリシーを作成していなかったため、
--   authenticated ユーザーが INSERT しても「new row violates
--   row-level security policy」で拒否されていた。
--   product_sales と同じ is_admin() / can_manage_business() パターンで
--   admin と business_admin にのみ操作を許可する。
-- ============================================================

-- -------------------------------------------------------
-- sale_sessions
-- -------------------------------------------------------

-- admin は全件操作可
DROP POLICY IF EXISTS "sale_sessions_admin_all" ON sale_sessions;
CREATE POLICY "sale_sessions_admin_all"
  ON sale_sessions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin は担当事業のセッションのみ操作可
DROP POLICY IF EXISTS "sale_sessions_business_admin_all" ON sale_sessions;
CREATE POLICY "sale_sessions_business_admin_all"
  ON sale_sessions
  FOR ALL
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

COMMENT ON POLICY "sale_sessions_admin_all"          ON sale_sessions IS 'admin は全レジ販売セッションを操作可';
COMMENT ON POLICY "sale_sessions_business_admin_all" ON sale_sessions IS 'business_admin は担当事業のセッションのみ操作可';

-- -------------------------------------------------------
-- sale_session_items（business_id を持たないため JOIN で確認）
-- -------------------------------------------------------

-- admin は全件操作可
DROP POLICY IF EXISTS "sale_session_items_admin_all" ON sale_session_items;
CREATE POLICY "sale_session_items_admin_all"
  ON sale_session_items
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- business_admin は担当事業のセッション明細のみ操作可
DROP POLICY IF EXISTS "sale_session_items_business_admin_all" ON sale_session_items;
CREATE POLICY "sale_session_items_business_admin_all"
  ON sale_session_items
  FOR ALL
  USING (
    is_business_admin() AND
    EXISTS (
      SELECT 1 FROM sale_sessions ss
      WHERE ss.id = sale_session_id
        AND can_manage_business(ss.business_id)
    )
  )
  WITH CHECK (
    is_business_admin() AND
    EXISTS (
      SELECT 1 FROM sale_sessions ss
      WHERE ss.id = sale_session_id
        AND can_manage_business(ss.business_id)
    )
  );

COMMENT ON POLICY "sale_session_items_admin_all"          ON sale_session_items IS 'admin は全明細を操作可';
COMMENT ON POLICY "sale_session_items_business_admin_all" ON sale_session_items IS 'business_admin は担当事業のセッション明細のみ操作可';

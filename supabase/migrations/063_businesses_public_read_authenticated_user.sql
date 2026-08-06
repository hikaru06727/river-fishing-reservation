-- ============================================================
-- Migration 063: businesses RLS — ログイン済み一般顧客の閲覧を許可
--
-- 背景（Phase 19E の実装中に発見した既存バグ。Phase 19E 自体とは
-- 独立した変更のため migration を分離する）:
--   Migration 057 は businesses_public_read を TO anon に限定した
--   （054 で TO 指定なし = PUBLIC だったため、business_admin/staff が
--    自分の割当外の事業まで閲覧できてしまうスコープ迂回バグを修正した）。
--
--   この修正の副作用として、ログイン済みの一般顧客（role='user'）が
--   businesses テーブルを一切閲覧できなくなっていた
--   （anon 向けポリシーのみで、authenticated かつ role='user' 向けの
--    代替ポリシーが用意されていなかったため）。
--
--   結果として、ログイン済み顧客が /shop/[slug] を開くと
--   findActiveBusinessBySlug() が null を返し 404 になる
--   （ゲスト＝anon での閲覧は問題なく動作するため、これまで顕在化
--    していなかった）。
--
-- 変更内容:
--   businesses_public_read_authenticated_user を新設し、
--   role='user' のみに限定して is_active な事業の閲覧を許可する。
--   role を 'user' に厳密に限定することで、054/057 で問題になった
--   business_admin/staff のスコープ迂回を再発させない
--   （business_admin/staff/admin の閲覧は既存の businesses_admin_all /
--    businesses_business_admin_select に委ねたまま変更しない）。
-- ============================================================

DROP POLICY IF EXISTS "businesses_public_read_authenticated_user" ON businesses;
CREATE POLICY "businesses_public_read_authenticated_user"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'user'
    )
  );

COMMENT ON POLICY "businesses_public_read_authenticated_user" ON businesses IS
  'ログイン済み一般顧客（role=user）のみ is_active な事業を閲覧可（顧客向けshopページ用）。
   business_admin/staff/admin は businesses_admin_all / businesses_business_admin_select の
   スコープに従うため、このポリシーには含めない（057 の bypass 再発防止）。';

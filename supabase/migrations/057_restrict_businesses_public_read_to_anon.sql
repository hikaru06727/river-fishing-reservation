-- ============================================================
-- Migration 057: businesses_public_read を anon 専用に限定
--
-- 背景:
--   Migration 054 の businesses_public_read ポリシーは TO 指定なし
--   （PUBLIC 扱い）で作成されていたため、is_active = TRUE の事業は
--   認証済みユーザー（business_admin/staff）からも閲覧可能になって
--   いた。RLS のポリシーは同一コマンドで OR 結合されるため、
--   business_admin_select / staff の割当スコープを迂回し、
--   findManageableBusinesses() 等が全事業を返す原因になっていた。
--
-- 変更内容:
--   businesses_public_read を TO anon に限定する。
--   認証済みユーザーの閲覧は既存の businesses_admin_all /
--   businesses_business_admin_select（can_manage_business 経由、
--   staff の staff_members 割当チェックを含む）に委ねる。
-- ============================================================

DROP POLICY IF EXISTS "businesses_public_read" ON businesses;
CREATE POLICY "businesses_public_read"
  ON businesses
  FOR SELECT
  TO anon
  USING (is_active = TRUE);

COMMENT ON POLICY "businesses_public_read" ON businesses IS
  '未認証ユーザー（anon）のみ、is_active = TRUE の事業を閲覧可（顧客向けshopページのslug解決用）。認証済みユーザーは businesses_admin_all / businesses_business_admin_select のスコープに従う。';

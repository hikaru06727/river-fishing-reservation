-- ============================================================
-- Migration 054: businesses の公開閲覧ポリシー（Phase 19A 追補）
--
-- 背景:
--   顧客向け商品ページのURLを /shop/[businessId] から /shop/[slug]
--   に変更するにあたり、未認証ユーザーが slug → business_id を
--   解決できる必要がある。しかし businesses テーブルの既存 RLS
--   ポリシーはいずれも TO authenticated のみで、anon は一切
--   businesses を閲覧できなかった（GRANT は 016 で付与済みだが
--   RLS が全件拒否していた）。
--
-- 変更内容:
--   is_active = TRUE の事業のみ、未認証ユーザーでも閲覧可能にする
--   ポリシーを追加する。既存の businesses_admin_all /
--   businesses_business_admin_select は変更しない。
-- ============================================================

DROP POLICY IF EXISTS "businesses_public_read" ON businesses;
CREATE POLICY "businesses_public_read"
  ON businesses
  FOR SELECT
  USING (is_active = TRUE);

COMMENT ON POLICY "businesses_public_read" ON businesses IS
  '未認証ユーザーを含め、is_active = TRUE の事業のみ閲覧可（顧客向けshopページのslug解決用）';

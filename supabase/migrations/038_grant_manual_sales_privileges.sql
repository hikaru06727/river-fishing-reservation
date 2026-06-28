-- ============================================================
-- Migration 038: manual_sales テーブルへの authenticated 権限付与
-- ============================================================
--
-- 027_create_manual_sales.sql では RLS ポリシーのみ定義され、
-- GRANT が漏れていた。authenticated ロール（admin / business_admin）が
-- テーブルレベルの操作権限を持てず、RLS 評価前にエラーになっていた。
-- （sale_sessions は 034 で GRANT 済み。manual_sales も同様に追加する）

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.manual_sales TO authenticated;

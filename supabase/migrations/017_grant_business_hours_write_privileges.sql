-- ============================================================
-- 017: 営業時間テーブルへの authenticated 書き込み GRANT
-- 実行順: 016_grant_public_read_privileges.sql の後
--
-- 背景:
--   016 で SELECT は付与済みだが、管理画面からの upsert / CRUD には
--   テーブルレベルの INSERT / UPDATE / DELETE も必要。
--   実際の書き込み可否は 015 の RLS（admin / business_admin）で制限。
--
-- 方針:
--   - anon には書き込み権限を付与しない
--   - authenticated のみ、営業時間関連 2 テーブルに限定
-- ============================================================

GRANT INSERT, UPDATE, DELETE ON TABLE public.fishing_spot_weekly_hours TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.fishing_spot_date_exceptions TO authenticated;

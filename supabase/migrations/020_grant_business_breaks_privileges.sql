-- ============================================================
-- 020: 休み時間テーブル向け GRANT（Phase 10b）
-- 実行順: 019_fishing_spot_business_breaks.sql の後
--
-- 方針（016 / 017 / 018 と整合）:
--   - anon / authenticated: SELECT のみ（RLS 前提）
--   - authenticated: INSERT / UPDATE / DELETE（RLS で admin / business_admin に限定）
--   - service_role: server-side admin client 用 CRUD
-- ============================================================

GRANT SELECT ON TABLE
  public.fishing_spot_weekly_breaks,
  public.fishing_spot_exception_breaks
TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE
  public.fishing_spot_weekly_breaks,
  public.fishing_spot_exception_breaks
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.fishing_spot_weekly_breaks,
  public.fishing_spot_exception_breaks
TO service_role;

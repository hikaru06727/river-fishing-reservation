-- ============================================================
-- 018: service_role 向けテーブル権限（server-side admin client 用）
-- 実行順: 017_grant_business_hours_write_privileges.sql の後
--
-- 背景:
--   016 は anon / authenticated への SELECT のみ付与。
--   createClient() + service_role（admin client）経由のサーバー処理では
--   テーブルレベルの USAGE / CRUD GRANT が別途必要。
--   ローカル db reset 後、fetchAffectedSlots 等が
--   42501 permission denied となるのを防ぐ。
--
-- 方針:
--   - RLS / RPC は変更しない
--   - anon / authenticated の権限は変更しない
--   - service_role はサーバー専用（NEXT_PUBLIC_* に置かない）
--   - 対象は RLS 有効の public テーブル（016 と同集合 + CRUD）
-- ============================================================

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.businesses,
  public.business_admin_assignments,
  public.fishing_spots,
  public.plans,
  public.availability_slots,
  public.reservations,
  public.payments,
  public.catch_reports,
  public.blog_posts,
  public.fishing_spot_weekly_hours,
  public.fishing_spot_date_exceptions
TO service_role;

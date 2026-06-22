-- ============================================================
-- 016: anon / authenticated 向け SELECT GRANT（RLS 前提）
-- 実行順: 015_fishing_spot_business_hours.sql の後
--
-- 背景:
--   ローカル db reset 後、hosted Supabase と異なり public テーブルへの
--   SELECT 権限が不足することがある。
--   RLS ポリシー評価（例: profiles ポリシー内の reservations 参照）でも
--   テーブルレベルの SELECT GRANT が必要。
--
-- 方針:
--   - 下記はいずれも RLS 有効テーブル（002 / 006 / 015 で ENABLE 済み）
--   - INSERT / UPDATE / DELETE は付与しない
--   - RLS 無効テーブルは対象外（public にそのようなテーブルは意図的に作らない）
-- ============================================================

-- RLS 有効化（冪等・002 / 006 / 015 と整合）
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fishing_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE catch_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_admin_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fishing_spot_weekly_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE fishing_spot_date_exceptions ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE
  public.profiles,
  public.fishing_spots,
  public.plans,
  public.availability_slots,
  public.reservations,
  public.payments,
  public.catch_reports,
  public.blog_posts,
  public.businesses,
  public.business_admin_assignments,
  public.fishing_spot_weekly_hours,
  public.fishing_spot_date_exceptions
TO anon, authenticated;

COMMENT ON SCHEMA public IS
  'anon/authenticated には RLS 保護テーブルへの SELECT のみ付与（016）。書き込みは RPC / service_role 経由。';

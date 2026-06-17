-- SQL Editor 006i: 適用後確認
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'businesses',
    'business_admin_assignments',
    'reservations',
    'payments',
    'fishing_spots',
    'availability_slots',
    'profiles'
  )
ORDER BY tablename, policyname;

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'is_admin',
    'is_business_admin',
    'is_management',
    'can_manage_business',
    'can_manage_spot'
  )
ORDER BY routine_name;

SELECT fs.slug, fs.name, b.slug AS business_slug, b.name AS business_name
FROM fishing_spots fs
LEFT JOIN businesses b ON b.id = fs.business_id
ORDER BY fs.slug;

-- business_admin テスト用（メール・UUID を差し替え）
-- UPDATE profiles SET role = 'business_admin' WHERE email = 'biz-admin@example.com';
-- INSERT INTO business_admin_assignments (user_id, business_id)
-- SELECT p.id, b.id FROM profiles p, businesses b
-- WHERE p.email = 'biz-admin@example.com' AND b.slug = 'biz-seiryu-keikoku'
-- ON CONFLICT DO NOTHING;

-- 007i: RLS hardening 適用後の確認

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'is_admin',
    'is_business_admin',
    'is_management',
    'can_manage_business',
    'can_manage_spot',
    'auth_profile_role',
    'owns_reservation'
  )
ORDER BY routine_name;

SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'businesses',
    'business_admin_assignments',
    'fishing_spots',
    'plans',
    'availability_slots',
    'reservations',
    'payments'
  )
ORDER BY tablename, policyname;

SELECT tgname
FROM pg_trigger
WHERE tgname = 'enforce_profile_role_immutability';

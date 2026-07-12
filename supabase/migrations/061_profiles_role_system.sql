-- ============================================================
-- Migration 061: profiles.role に 'system' を追加（Phase 19D 是正）
--
-- 背景:
--   060 で追加した is_system プレースホルダー profile（自動返金の
--   refunded_by 用アクター）を role='admin' として作成していたが、
--   これは実装途中で破棄された設計（refundCard() への疑似 profile 渡し）
--   の残骸であり、技術的必然性がなかった。
--   実際の自動返金処理（autoRefundReservationOnCancel）は
--   hasPermission() / canManageBusinessForProfile() を一切呼ばず、
--   createAdminClient()（service_role）のみで完結するため role は
--   admin である必要がない。
--
--   一方 middleware.ts の /admin/* ゲートや management-access.ts の
--   canManageBusinessForProfile 等、role のみで管理者権限を判定する
--   箇所が多数あり、is_system による除外は一切実装されていないため、
--   role='admin' のまま残すことは不要なリスクだった。
--
--   既存の admin/business_admin/staff/user のいずれとも異なる
--   'system' を新設し、権限判定上どこにもマッチしない値にする。
-- ============================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'business_admin', 'staff', 'system'));

COMMENT ON CONSTRAINT profiles_role_check ON profiles IS
  'system は is_system=true のプレースホルダー profile 専用。アプリの権限判定（is_admin 等）には一切マッチしない。';

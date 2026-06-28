-- ============================================================
-- Migration 040: staff_members テーブルへの service_role 権限付与
-- ============================================================
--
-- 039_create_staff_members.sql では authenticated への GRANT のみ付与され、
-- service_role（createAdminClient 経由のサーバー処理）への GRANT が漏れていた。
-- insertStaffMember / acceptStaffInvitation 等が service_role で実行されるため
-- テーブルレベルの操作権限が必要。（cf. migration 018 の同パターン）

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_members TO service_role;

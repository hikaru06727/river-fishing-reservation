-- ============================================================
-- Migration 064: online_orders.user_id 追加（Phase 20 顧客アカウント機能）
--
-- 背景:
--   online_orders は Phase 19B 時点では完全ゲスト注文のみを想定しており
--   ユーザー紐付けカラムが存在しなかった。Phase 20 でログイン顧客が
--   自分の注文履歴（/my/orders）を閲覧できるようにするため、
--   auth.uid() との紐付けカラムを追加する。
--
--   ゲスト注文を今後も許可し続けるため NULL 許容とし、
--   profiles 削除時は注文レコード自体は残す（ON DELETE SET NULL）。
--   reservations.user_id（NOT NULL・ON DELETE CASCADE）とは異なる方針。
--
-- 変更内容:
--   1. online_orders.user_id 追加（NULL許容）
--   2. インデックス追加（本人の注文一覧取得用）
--   3. online_orders_owner_select RLS ポリシー追加
--      （auth.uid() = user_id の注文のみ本人が閲覧可能。
--       既存の admin_all / business_admin_all / staff_select は変更しない）
--
-- ロールバック方針:
--   DROP POLICY IF EXISTS "online_orders_owner_select" ON online_orders;
--   DROP INDEX IF EXISTS idx_online_orders_user_id;
--   ALTER TABLE online_orders DROP COLUMN IF EXISTS user_id;
-- ============================================================

-- ------------------------------------------------------------
-- 1. online_orders.user_id
-- ------------------------------------------------------------
ALTER TABLE online_orders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN online_orders.user_id IS
  'チェックアウト時にログイン済みだった場合の注文者（Phase 20）。
   NULL 許容 = ゲスト注文は今後も許可する。profiles 削除時は SET NULL
   （reservations.user_id の CASCADE とは異なり、注文記録自体は残す）。';

-- ------------------------------------------------------------
-- 2. インデックス（本人の注文一覧取得用）
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_online_orders_user_id
  ON online_orders (user_id)
  WHERE user_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3. RLS: 本人閲覧ポリシー
--    anon: 明示的な GRANT が無いため online_orders に一切アクセス不可
--          （055 の方針を踏襲。書き込みは service_role 経由のみ）。
--    authenticated: 本人（auth.uid() = user_id）の注文のみ SELECT 可能。
--                   既存の admin_all / business_admin_all / staff_select
--                   ポリシーとは OR 条件で併存し、互いに競合しない。
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "online_orders_owner_select" ON online_orders;
CREATE POLICY "online_orders_owner_select"
  ON online_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- GRANT は既存 (055) の SELECT, INSERT, UPDATE ON online_orders TO authenticated
-- を流用する（新規 GRANT は不要）。

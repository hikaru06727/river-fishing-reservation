-- ============================================================
-- Migration 060: 予約への同時購入（アドオン）基盤（Phase 19D）
--
-- 背景:
--   予約フローの最終確認前に、事業者の公開商品（Phase 19A）を
--   同時購入できるようにする。決済方式は予約本体の選択（オンライン/
--   現地）にそのまま乗せ、顧客に決済方法を二重に選ばせない。
--
-- 変更内容:
--   1. profiles.is_system 追加（自動返金アクター識別用プレースホルダー
--      profile を区別するため。profile 自体の作成は別途
--      scripts/setup-system-profile.mjs で環境ごとに1回実行する。
--      auth.users への直接 INSERT は本 migration には含めない）
--   2. reservation_addon_items テーブル作成
--      （予約自体をヘッダーとして扱い、online_orders のような
--       別ヘッダーテーブルは作らない。予約合計は都度 SUM で算出し、
--       reservations への非正規化カラムは追加しない）
--   3. payment_ledger.source_type に 'reservation_addon' を追加
--      （'online_order' は migration 056 で既に追加済み。今回はその
--       延長で 1 値追加するのみ）
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles.is_system
-- ------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.is_system IS
  'TRUE の場合、システム自動処理専用のプレースホルダー profile（ログイン不可・一覧表示除外対象）。scripts/setup-system-profile.mjs で環境ごとに1件のみ作成する。';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_is_system_true
  ON profiles (is_system)
  WHERE is_system = TRUE;

COMMENT ON INDEX idx_profiles_is_system_true IS
  'is_system = TRUE の profile は環境内で高々1件のみ許可する';

-- ------------------------------------------------------------
-- 2. reservation_addon_items テーブル
--    予約に紐づくアドオン商品明細（商品名・単価・税率は選択時点の
--    スナップショット）。在庫引当は非同期（Stripe Webhook / 現地精算時）
--    に行うため、引当済みかどうかを stock_decremented_at で判定する。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservation_addon_items (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id       UUID        NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  product_id           UUID        NOT NULL REFERENCES products(id),
  product_name         TEXT        NOT NULL,
  unit_price           INTEGER     NOT NULL CHECK (unit_price >= 0),
  tax_rate             NUMERIC     NOT NULL,
  quantity             INTEGER     NOT NULL CHECK (quantity > 0),
  status               TEXT        NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active', 'cancelled')),
  stock_decremented_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, product_id)
);

COMMENT ON TABLE reservation_addon_items IS '予約への同時購入アドオン明細（Phase 19D）。予約自体がヘッダーの役割を果たす。';
COMMENT ON COLUMN reservation_addon_items.unit_price IS '税抜き単価（円・選択時点のスナップショット）';
COMMENT ON COLUMN reservation_addon_items.tax_rate IS '選択時点の税率スナップショット';
COMMENT ON COLUMN reservation_addon_items.status IS 'active=有効, cancelled=予約キャンセルに伴い無効化';
COMMENT ON COLUMN reservation_addon_items.stock_decremented_at IS '在庫引当（decrement）済み日時。NULL は未引当。';

CREATE INDEX IF NOT EXISTS idx_reservation_addon_items_reservation_id
  ON reservation_addon_items (reservation_id);

-- ------------------------------------------------------------
-- 3. RLS
--    reservations と同じ方針: 作成/更新/キャンセル反映は service_role
--    (アプリの service 層) のみ。authenticated への直接 INSERT/UPDATE
--    ポリシーは意図的に作らない（007_harden_rls.sql の reservations 方針を踏襲）。
-- ------------------------------------------------------------
ALTER TABLE reservation_addon_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservation_addon_items_select_own" ON reservation_addon_items;
CREATE POLICY "reservation_addon_items_select_own"
  ON reservation_addon_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id = reservation_id AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reservation_addon_items_admin_select" ON reservation_addon_items;
CREATE POLICY "reservation_addon_items_admin_select"
  ON reservation_addon_items FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "reservation_addon_items_business_admin_select" ON reservation_addon_items;
CREATE POLICY "reservation_addon_items_business_admin_select"
  ON reservation_addon_items FOR SELECT TO authenticated
  USING (
    is_business_admin() AND EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id = reservation_id AND can_manage_location(r.spot_id)
    )
  );

DROP POLICY IF EXISTS "reservation_addon_items_staff_select" ON reservation_addon_items;
CREATE POLICY "reservation_addon_items_staff_select"
  ON reservation_addon_items FOR SELECT TO authenticated
  USING (
    is_staff() AND EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id = reservation_id AND can_manage_location(r.spot_id)
    )
  );

-- reservation_addon_items_insert/update/delete は意図的に作らない
-- （reservations 本体と同じ方針。書き込みは service_role 経由のみ）

-- ------------------------------------------------------------
-- 4. GRANT
-- ------------------------------------------------------------
GRANT SELECT ON reservation_addon_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON reservation_addon_items TO service_role;

-- ------------------------------------------------------------
-- 5. payment_ledger.source_type に 'reservation_addon' を追加
--    （'online_order' は migration 056 で追加済み。以降 057/058/059 は
--     source_type に触れていないことをファイル履歴で確認済み）
-- ------------------------------------------------------------
ALTER TABLE payment_ledger
  DROP CONSTRAINT IF EXISTS payment_ledger_source_type_check;

ALTER TABLE payment_ledger
  ADD CONSTRAINT payment_ledger_source_type_check
    CHECK (source_type IN ('pos', 'reservation', 'manual', 'online_order', 'reservation_addon'));

COMMENT ON COLUMN payment_ledger.source_type IS
  '売上種別: pos=sale_sessions, reservation=reservations, manual=manual_sales, online_order=online_orders, reservation_addon=reservation_addon_items（同一 reservation_id に紐づく予約分とは別レコード）';

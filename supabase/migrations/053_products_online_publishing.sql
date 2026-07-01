-- ============================================================
-- Migration 053: 商品の公開設定・在庫管理基盤（Phase 19A）
--
-- 背景:
--   物販ECサイト機能の最初のステップとして、商品ごとに
--   「オンライン公開するか」「在庫数を厳密管理するか」を
--   設定できるようにする。stock_quantity / image_url は
--   migration 030 で既に存在し店頭販売（POS）で使用中のため
--   再利用し、重複カラムは作らない。
--
-- 変更内容:
--   1. products に is_published_online / track_inventory /
--      shippable / description_online を追加
--   2. products_public_read ポリシー追加
--      （is_published_online = TRUE の商品は未認証でも閲覧可）
--      既存の admin / business_admin ポリシーは変更しない
--   3. products_staff_select（SELECT のみ）を
--      products_staff_all（FOR ALL）に昇格
--      （staff に PRODUCT_MANAGE 権限を付与するため。041 で
--       追加された SELECT 専用ポリシーを編集可能にする）
-- ============================================================

-- ------------------------------------------------------------
-- 1. カラム追加
-- ------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_published_online BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS track_inventory      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shippable            BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS description_online   TEXT;

COMMENT ON COLUMN products.is_published_online IS 'TRUE の場合、顧客向けECサイトに表示される';
COMMENT ON COLUMN products.track_inventory      IS 'TRUE の場合のみ stock_quantity を在庫切れ判定に使用する';
COMMENT ON COLUMN products.shippable            IS 'TRUE の場合は配送対象商品（19B以降の配送設定で使用）';
COMMENT ON COLUMN products.description_online   IS 'ECサイト商品詳細ページ用の説明文（description とは別管理）';

CREATE INDEX IF NOT EXISTS idx_products_is_published_online
  ON products (business_id, is_published_online)
  WHERE is_published_online = TRUE;

-- ------------------------------------------------------------
-- 2. RLS: 顧客向け公開商品の閲覧ポリシー
--    既存の products_admin_all / products_business_admin_all は変更しない
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "products_public_read" ON products;
CREATE POLICY "products_public_read"
  ON products
  FOR SELECT
  USING (is_published_online = TRUE);

COMMENT ON POLICY "products_public_read" ON products IS
  '未認証ユーザーを含め、is_published_online = TRUE の商品のみ閲覧可';

-- ------------------------------------------------------------
-- 3. RLS: staff の products 操作権限を SELECT のみ → ALL に昇格
--    （staff に PRODUCT_MANAGE を付与するため。041 で追加した
--     products_staff_select を置き換える）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "products_staff_select" ON products;
DROP POLICY IF EXISTS "products_staff_all" ON products;
CREATE POLICY "products_staff_all"
  ON products FOR ALL TO authenticated
  USING (is_staff() AND can_manage_business(business_id))
  WITH CHECK (is_staff() AND can_manage_business(business_id));

COMMENT ON POLICY "products_staff_all" ON products IS
  'staff は所属事業（active）の商品を閲覧・編集可（Phase 19A: PRODUCT_MANAGE 付与）';

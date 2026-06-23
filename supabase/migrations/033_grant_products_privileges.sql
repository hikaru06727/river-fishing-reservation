-- ============================================================
-- Migration 033: products / product_sales への authenticated GRANT
--
-- 背景:
--   030 / 031 で service_role への GRANT は付与済みだが、
--   Next.js の createClient()（JWT ベース）で PostgREST が
--   authenticated ロールとして実行する際に
--   テーブルレベルの GRANT が不足し "permission denied" が発生する。
--   実際の読み書き可否は各テーブルの RLS ポリシーで制御する。
--
-- 方針:
--   - anon は SELECT のみ（RLS により実際にはゼロ行が返る）
--   - authenticated は SELECT + 書き込み（RLS が admin/business_admin に限定）
--   - product_sales は anon アクセス不要のため authenticated のみ
-- ============================================================

-- products
GRANT SELECT ON TABLE public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;

-- product_sales
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_sales TO authenticated;

-- ============================================================
-- Migration 065: profiles 住所・電話番号カラム追加（Phase 20 顧客アカウント機能）
--
-- 背景:
--   チェックアウト時、ログイン済み顧客の氏名・住所・電話番号を自動入力
--   するため、profiles に再利用可能な形で保存する。online_orders の
--   直近注文からの補完だけでは、予約のみの既存顧客や初回購入者に
--   自動入力が効かないため、profiles 側にも保持する。
--
--   チェックアウトフォームの「この住所を今後のために保存する」チェック
--   （デフォルトON）が外された場合は、当該注文にのみ使用し
--   profiles は更新しない（アプリ側で制御。DB制約は設けない）。
--
-- 変更内容:
--   profiles に phone / postal_code / prefecture / address_line1 /
--   address_line2 を追加（すべて NULL 許容）。
--
-- ロールバック方針:
--   ALTER TABLE profiles
--     DROP COLUMN IF EXISTS phone,
--     DROP COLUMN IF EXISTS postal_code,
--     DROP COLUMN IF EXISTS prefecture,
--     DROP COLUMN IF EXISTS address_line1,
--     DROP COLUMN IF EXISTS address_line2;
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone           TEXT,
  ADD COLUMN IF NOT EXISTS postal_code     TEXT,
  ADD COLUMN IF NOT EXISTS prefecture      TEXT,
  ADD COLUMN IF NOT EXISTS address_line1   TEXT,
  ADD COLUMN IF NOT EXISTS address_line2   TEXT;

COMMENT ON COLUMN profiles.phone IS 'チェックアウト自動入力用（Phase 20）。任意入力。';
COMMENT ON COLUMN profiles.postal_code IS 'チェックアウト自動入力用（Phase 20）。任意入力。';
COMMENT ON COLUMN profiles.prefecture IS 'チェックアウト自動入力用（Phase 20）。任意入力。';
COMMENT ON COLUMN profiles.address_line1 IS 'チェックアウト自動入力用（Phase 20）。任意入力。';
COMMENT ON COLUMN profiles.address_line2 IS 'チェックアウト自動入力用（Phase 20）。任意入力（建物名など）。';

-- 既存の profiles RLS（本人 SELECT/UPDATE 可能なポリシー）に追加カラムは
-- 自動的に含まれるため、RLS/GRANT の変更は不要。

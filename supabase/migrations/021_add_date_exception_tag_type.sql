-- ============================================================
-- 021: 例外日カレンダータグ（Phase 10c）
-- 実行順: 020_grant_business_breaks_privileges.sql の後
--
-- fishing_spot_date_exceptions.tag_type: カレンダー表示用タグ
-- 予約可否は is_open / 営業時間 / break 設定を優先（アプリ層）
-- ============================================================

ALTER TABLE fishing_spot_date_exceptions
  ADD COLUMN IF NOT EXISTS tag_type TEXT;

ALTER TABLE fishing_spot_date_exceptions
  DROP CONSTRAINT IF EXISTS date_exceptions_tag_type_check;

ALTER TABLE fishing_spot_date_exceptions
  ADD CONSTRAINT date_exceptions_tag_type_check
  CHECK (
    tag_type IS NULL OR tag_type IN (
      'closed',
      'temporary_closed',
      'special_open',
      'short_hours',
      'event',
      'maintenance',
      'other'
    )
  );

COMMENT ON COLUMN fishing_spot_date_exceptions.tag_type IS
  'カレンダー表示用タグ。予約可否は is_open / 営業時間 / break 設定を優先する。';

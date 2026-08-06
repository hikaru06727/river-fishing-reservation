-- ============================================================
-- Migration 058: online_orders に受け取り日時・確認コード・発送日を追加
--
-- 背景（Phase 19C-2）:
--   店舗受け取り注文向けに、希望受け取り日時と受け取り期限（自動
--   キャンセル基準）、現地確認用の6桁確認コードを追加する。
--   配送注文向けには shipped_at（発送日時）を追加し、売上集計・
--   追跡の基準に使う。
--
-- 変更内容:
--   - pickup_date: 希望受け取り日時（店舗受け取りのみ・null許容）
--   - pickup_deadline: 受け取り期限（pickup_date + 3日・null許容）
--   - confirmation_code: 受け取り確認用6桁コード（null許容）
--   - shipped_at: 発送日時（null許容）
--   破壊的変更ではない（既存行への影響なし、NULL許容カラムの追加のみ）。
-- ============================================================

ALTER TABLE online_orders
  ADD COLUMN IF NOT EXISTS pickup_date TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pickup_deadline TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS confirmation_code CHAR(6) NULL,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN online_orders.pickup_date IS '希望受け取り日時（店舗受け取りのみ）';
COMMENT ON COLUMN online_orders.pickup_deadline IS '受け取り期限（pickup_date + 3日）。超過時は cron で自動キャンセル対象';
COMMENT ON COLUMN online_orders.confirmation_code IS '受け取り確認用6桁コード（顧客通知・現地確認用。管理画面での照合は server 側のみで行う）';
COMMENT ON COLUMN online_orders.shipped_at IS '発送日時（配送注文の売上集計・追跡の基準）';

-- 管理画面「本日の受け取り予定」タブ・期限切れ自動キャンセル cron 向け
CREATE INDEX IF NOT EXISTS idx_online_orders_business_pickup_date
  ON online_orders (business_id, pickup_date)
  WHERE pickup_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_online_orders_pickup_deadline
  ON online_orders (pickup_deadline)
  WHERE pickup_deadline IS NOT NULL;

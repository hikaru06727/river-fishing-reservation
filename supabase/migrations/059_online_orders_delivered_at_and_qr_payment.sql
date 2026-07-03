-- ============================================================
-- Migration 059: online_orders に delivered_at 追加・
--                 payment_ledger.payment_method に qr を追加
--
-- 背景（Phase 19C-3）:
--   店頭受け取り注文の受け取り確認時に、支払い方法（現金/カード/
--   QRコード決済）を選択して payment_ledger に記録できるようにする。
--   売上集計の基準日（配送=shipped_at、受け取り=delivered_at）用に
--   delivered_at カラムを追加する。
--
-- 設計メモ（実装前確認・2026-07-03時点の制約内容）:
--   - payment_ledger_payment_method_check は既に
--     CHECK (payment_method IN ('cash','card','other')) だった。
--     'card' は元から許可されており、追加が必要なのは 'qr' のみ。
--   - online_orders.payment_method（'stripe'|'in_person'）は今回
--     変更しない。受け取り確認時の実際の支払い方法は payment_ledger
--     側にのみ記録し、online_orders.payment_method は注文開始時の
--     決済区分（オンライン/現地）を表す値として維持する。
--
-- 変更内容:
--   1. online_orders.delivered_at TIMESTAMPTZ NULL を追加
--   2. payment_ledger_payment_method_check に 'qr' を追加
--   破壊的変更ではない（既存行への影響なし、NULL許容カラム追加と
--   CHECK 制約の許容値追加のみ）。
-- ============================================================

ALTER TABLE online_orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN online_orders.delivered_at IS '受け渡し完了日時（店舗受け取り注文の売上集計基準）';

ALTER TABLE payment_ledger
  DROP CONSTRAINT IF EXISTS payment_ledger_payment_method_check;

ALTER TABLE payment_ledger
  ADD CONSTRAINT payment_ledger_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'other', 'qr'));

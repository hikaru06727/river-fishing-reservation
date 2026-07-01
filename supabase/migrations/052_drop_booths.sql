-- ============================================================
-- Migration 052: booths/booth_slots/booth_bookings DROP（Phase 14 巻き戻し）
--
-- 目的:
--   Phase 14 で追加したブース・出店枠管理テーブルを削除する。
--   payment_ledger.source_type の CHECK 制約を元の3種類に戻す。
--
-- 変更内容:
--   1. booth_bookings テーブル DROP
--   2. booth_slots テーブル DROP
--   3. booths テーブル DROP
--   4. payment_ledger.source_type CHECK 制約を復元
--      （'booth' を除外: 'pos' | 'reservation' | 'manual' のみ）
-- ============================================================

DROP TABLE IF EXISTS booth_bookings CASCADE;
DROP TABLE IF EXISTS booth_slots CASCADE;
DROP TABLE IF EXISTS booths CASCADE;

ALTER TABLE payment_ledger
  DROP CONSTRAINT IF EXISTS payment_ledger_source_type_check;

ALTER TABLE payment_ledger
  ADD CONSTRAINT payment_ledger_source_type_check
    CHECK (source_type IN ('pos', 'reservation', 'manual'));

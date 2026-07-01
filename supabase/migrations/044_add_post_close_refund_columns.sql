-- Migration 044: 締め後返金差分カラムを register_closings に追加
ALTER TABLE register_closings
  ADD COLUMN post_close_refund_cash    numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN post_close_refund_card    numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN post_close_refund_other   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN post_close_refund_total   numeric(12,2) NOT NULL DEFAULT 0;

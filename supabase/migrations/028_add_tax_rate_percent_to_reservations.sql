-- ============================================================
-- Migration 028: reservations に tax_rate_percent を追加
--
-- 予約作成時点の税率スナップショット用。
-- 既存データは NULL のまま互換性あり。
-- ============================================================

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS tax_rate_percent INTEGER
    CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100);

COMMENT ON COLUMN reservations.tax_rate_percent IS
  '予約作成時点の消費税率スナップショット（%）。既存データは NULL。';

-- ============================================================
-- Migration 024: tax_rates テーブル作成
-- ============================================================

CREATE TABLE IF NOT EXISTS tax_rates (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_percent INTEGER      NOT NULL CHECK (rate_percent >= 0 AND rate_percent <= 100),
  valid_from   DATE         NOT NULL,
  valid_until  DATE,
  created_by   UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT tax_rates_valid_period_check CHECK (valid_until IS NULL OR valid_until > valid_from)
);

COMMENT ON TABLE tax_rates IS '消費税率マスタ。有効期間で税率を管理する。';
COMMENT ON COLUMN tax_rates.rate_percent IS '税率（整数 %）。例: 10 → 10%';
COMMENT ON COLUMN tax_rates.valid_from   IS '税率の適用開始日（当日含む）';
COMMENT ON COLUMN tax_rates.valid_until  IS '税率の適用終了日（NULL = 現在も有効）';

-- ------------------------------------------------------------
-- 初期データ（2019年10月〜現行税率 10%）
-- ------------------------------------------------------------
INSERT INTO tax_rates (rate_percent, valid_from)
VALUES (10, '2019-10-01')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;

-- 全ユーザー（匿名含む）が参照可
DROP POLICY IF EXISTS "tax_rates_select_all" ON tax_rates;
CREATE POLICY "tax_rates_select_all"
  ON tax_rates
  FOR SELECT
  USING (true);

-- 書き込みは admin のみ
DROP POLICY IF EXISTS "tax_rates_admin_all" ON tax_rates;
CREATE POLICY "tax_rates_admin_all"
  ON tax_rates
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

COMMENT ON POLICY "tax_rates_select_all" ON tax_rates IS '税率は全ユーザー（匿名含む）が参照可';
COMMENT ON POLICY "tax_rates_admin_all"  ON tax_rates IS '税率の追加・変更は admin のみ';

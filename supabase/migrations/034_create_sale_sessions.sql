-- ============================================================
-- Migration 034: sale_sessions・sale_session_items テーブル作成
--                product_sales に sale_session_id カラム追加
-- ============================================================

-- レジ販売セッション（カートまとめて1件）
CREATE TABLE sale_sessions (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        UUID          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sold_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  payment_method     TEXT          NOT NULL CHECK (payment_method IN ('cash', 'stripe')),
  tax_rate_percent   NUMERIC(5,2)  NOT NULL,
  subtotal_amount    INTEGER       NOT NULL,  -- 税抜合計（円）
  tax_amount         INTEGER       NOT NULL,  -- 消費税額（円）
  total_amount       INTEGER       NOT NULL,  -- 税込合計（円）
  note               TEXT,
  created_by         UUID          REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- セッション内の商品明細
CREATE TABLE sale_session_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_session_id  UUID        NOT NULL REFERENCES sale_sessions(id) ON DELETE CASCADE,
  product_id       UUID        NOT NULL REFERENCES products(id),
  quantity         INTEGER     NOT NULL CHECK (quantity > 0),
  unit_price       INTEGER     NOT NULL,  -- 販売時点の税抜単価スナップショット
  subtotal         INTEGER     NOT NULL,  -- quantity * unit_price
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS 有効化
ALTER TABLE sale_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_session_items ENABLE ROW LEVEL SECURITY;

-- authenticated ユーザーに権限付与（業務スコープは service 層で制御）
GRANT SELECT, INSERT, UPDATE ON sale_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON sale_session_items TO authenticated;

-- product_sales に sale_session_id を追加
-- POS 経由の product_sales と直販の product_sales を区別するため
ALTER TABLE product_sales
  ADD COLUMN sale_session_id UUID REFERENCES sale_sessions(id) ON DELETE SET NULL;

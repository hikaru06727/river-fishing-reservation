-- ============================================================
-- 川釣り予約サービス — 初期スキーマ
-- 実行順: 1番目（002_rls_policies.sql の前に実行）
-- ============================================================

-- ------------------------------------------------------------
-- profiles（auth.users 拡張）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'ユーザープロフィール（Supabase Auth と連携）';

-- ------------------------------------------------------------
-- fishing_spots（釣り場）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fishing_spots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  address     TEXT,
  prefecture  TEXT,
  capacity    INT NOT NULL DEFAULT 10 CHECK (capacity > 0),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fishing_spots IS '釣り場マスタ';

-- ------------------------------------------------------------
-- plans（1時間 / 3時間プラン）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  price_yen        INT NOT NULL CHECK (price_yen >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE plans IS '予約プラン（1h / 3h）';

-- ------------------------------------------------------------
-- availability_slots（空き枠）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS availability_slots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id      UUID NOT NULL REFERENCES fishing_spots(id) ON DELETE CASCADE,
  slot_date    DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  max_capacity INT NOT NULL DEFAULT 5 CHECK (max_capacity > 0),
  booked_count INT NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'closed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (spot_id, slot_date, start_time),
  CHECK (end_time > start_time),
  CHECK (booked_count <= max_capacity)
);

COMMENT ON TABLE availability_slots IS '釣り場ごとの日別空き枠';

-- ------------------------------------------------------------
-- reservations（予約）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  spot_id                    UUID NOT NULL REFERENCES fishing_spots(id),
  plan_id                    UUID NOT NULL REFERENCES plans(id),
  slot_id                    UUID NOT NULL REFERENCES availability_slots(id),
  reservation_date           DATE NOT NULL,
  start_time                 TIME NOT NULL,
  end_time                   TIME NOT NULL,
  guest_count                INT NOT NULL DEFAULT 1 CHECK (guest_count > 0),
  total_amount_yen           INT NOT NULL CHECK (total_amount_yen >= 0),
  status                     TEXT NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
  stripe_checkout_session_id TEXT,
  expires_at                 TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE reservations IS '予約（pending → confirmed / cancelled / expired）';

-- ------------------------------------------------------------
-- payments（決済）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id             UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
  stripe_payment_intent_id   TEXT,
  stripe_checkout_session_id TEXT,
  amount_yen                 INT NOT NULL CHECK (amount_yen >= 0),
  currency                   TEXT NOT NULL DEFAULT 'jpy',
  status                     TEXT NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  paid_at                    TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE payments IS 'Stripe 決済記録';

-- ------------------------------------------------------------
-- catch_reports（釣果情報）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catch_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id      UUID NOT NULL REFERENCES fishing_spots(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES profiles(id),
  title        TEXT NOT NULL,
  fish_species TEXT,
  weight_kg    NUMERIC(5, 2),
  length_cm    NUMERIC(5, 1),
  description  TEXT,
  image_url    TEXT,
  caught_date  DATE,
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE catch_reports IS '釣果レポート';

-- ------------------------------------------------------------
-- blog_posts（ブログ）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES profiles(id),
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  excerpt         TEXT,
  content         TEXT NOT NULL,
  cover_image_url TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published')),
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE blog_posts IS 'ブログ記事';

-- ------------------------------------------------------------
-- インデックス
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_slots_spot_date
  ON availability_slots (spot_id, slot_date, status);

CREATE INDEX IF NOT EXISTS idx_reservations_user
  ON reservations (user_id, status, reservation_date);

CREATE INDEX IF NOT EXISTS idx_reservations_spot_date
  ON reservations (spot_id, reservation_date);

CREATE INDEX IF NOT EXISTS idx_payments_reservation
  ON payments (reservation_id);

CREATE INDEX IF NOT EXISTS idx_blog_published
  ON blog_posts (status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_catches_published
  ON catch_reports (status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_catches_spot
  ON catch_reports (spot_id, status);

CREATE INDEX IF NOT EXISTS idx_fishing_spots_slug
  ON fishing_spots (slug) WHERE is_active = TRUE;

-- ------------------------------------------------------------
-- updated_at 自動更新トリガー
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS fishing_spots_updated_at ON fishing_spots;
CREATE TRIGGER fishing_spots_updated_at
  BEFORE UPDATE ON fishing_spots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS reservations_updated_at ON reservations;
CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS catch_reports_updated_at ON catch_reports;
CREATE TRIGGER catch_reports_updated_at
  BEFORE UPDATE ON catch_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS blog_posts_updated_at ON blog_posts;
CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 新規ユーザー登録時に profiles を自動作成
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

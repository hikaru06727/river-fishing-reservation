-- ============================================================
-- Migration 023: Add category and booking_type to locations
-- ============================================================

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'fishing'
    CHECK (category IN ('fishing', 'camping', 'cafe', 'salon', 'rental_space', 'experience', 'retail', 'other')),
  ADD COLUMN IF NOT EXISTS booking_type TEXT NOT NULL DEFAULT 'time_slot'
    CHECK (booking_type IN ('time_slot', 'seat', 'resource', 'staff'));

COMMENT ON COLUMN locations.category     IS 'ロケーションの業種カテゴリ（fishing / camping / cafe / salon / rental_space / experience / retail / other）';
COMMENT ON COLUMN locations.booking_type IS '予約単位タイプ（time_slot / seat / resource / staff）';

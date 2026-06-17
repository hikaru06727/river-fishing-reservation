-- SQL Editor 006b: fishing_spots.business_id
ALTER TABLE fishing_spots
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fishing_spots_business_id
  ON fishing_spots (business_id);

COMMENT ON COLUMN fishing_spots.business_id IS '所属事業。business_admin のスコープ判定に使用。';

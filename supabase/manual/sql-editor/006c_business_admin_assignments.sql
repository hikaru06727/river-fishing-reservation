-- SQL Editor 006c: business_admin_assignments
CREATE TABLE IF NOT EXISTS business_admin_assignments (
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_business_admin_assignments_business_id
  ON business_admin_assignments (business_id);

COMMENT ON TABLE business_admin_assignments IS '事業管理者の担当事業割当';

ALTER TABLE business_admin_assignments ENABLE ROW LEVEL SECURITY;

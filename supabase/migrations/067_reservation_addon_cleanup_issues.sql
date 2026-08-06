-- ============================================================
-- Migration 067: アドオン後処理失敗の要対応トラッキング
--
-- 背景:
--   cancelReservation() の技術的負債整理の一環（Part 2）。
--   cancelAddonItemsAndRestoreStock() は3ステップ
--   （①明細のcancelled化 ②在庫復元 ③payment_ledger更新）から成るが、
--   いずれかが失敗しても console.error のログのみで、検知・追跡の手段が
--   管理画面上に存在しなかった（Part 1の sale_refunds と同種の問題）。
--
--   本 migration では新規テーブル reservation_addon_cleanup_issues を作成し、
--   3ステップのうち1つでも失敗した場合に1件の記録として残せるようにする。
--   sale_refunds のような既存の「正常系レコード」への追加カラムではなく、
--   このテーブルの行そのものが「失敗が起きたことの記録」である点が
--   sale_refunds/resolved_at（migration 066）との違い。
-- ============================================================

CREATE TABLE IF NOT EXISTS reservation_addon_cleanup_issues (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID        NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  business_id     UUID        NOT NULL REFERENCES businesses(id),
  failed_steps    TEXT[]      NOT NULL,
  detail          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_note TEXT,
  CONSTRAINT reservation_addon_cleanup_issues_failed_steps_valid CHECK (
    array_length(failed_steps, 1) > 0
    AND failed_steps <@ ARRAY['mark_cancelled', 'restore_stock', 'update_ledger']::text[]
  )
);

COMMENT ON TABLE reservation_addon_cleanup_issues IS
  'cancelAddonItemsAndRestoreStock() の失敗記録（Part 2）。行が存在すること自体が「対応が必要」を意味する。';
COMMENT ON COLUMN reservation_addon_cleanup_issues.failed_steps IS
  '失敗したステップ（mark_cancelled=明細cancelled化, restore_stock=在庫復元, update_ledger=payment_ledger更新）。複数同時に失敗しうる。';
COMMENT ON COLUMN reservation_addon_cleanup_issues.detail IS '失敗時の例外メッセージ等（任意）';
COMMENT ON COLUMN reservation_addon_cleanup_issues.resolved_at IS
  '管理者が手動対応を完了させた日時。未対応かどうかはこのカラムの有無で判定する。';
COMMENT ON COLUMN reservation_addon_cleanup_issues.resolved_by IS '対応済みにした管理者の profiles.id';
COMMENT ON COLUMN reservation_addon_cleanup_issues.resolution_note IS '手動対応の内容メモ（任意）';

CREATE INDEX IF NOT EXISTS idx_reservation_addon_cleanup_issues_business_id
  ON reservation_addon_cleanup_issues (business_id);
CREATE INDEX IF NOT EXISTS idx_reservation_addon_cleanup_issues_reservation_id
  ON reservation_addon_cleanup_issues (reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_addon_cleanup_issues_created_at
  ON reservation_addon_cleanup_issues (created_at DESC);

-- 「事業ごとの未対応記録」を管理画面で一覧表示する際に使う部分インデックス
-- （migration 066 の idx_sale_refunds_unresolved_failed と同じ考え方）
CREATE INDEX IF NOT EXISTS idx_reservation_addon_cleanup_issues_unresolved
  ON reservation_addon_cleanup_issues (business_id, created_at DESC)
  WHERE resolved_at IS NULL;

-- ------------------------------------------------------------
-- RLS: sale_refunds（043_create_sale_refunds.sql）の3ポリシーを踏襲。
--   書き込み（INSERT）は cancelAddonItemsAndRestoreStock から service_role
--   経由でのみ行うため、staff 向けの INSERT ポリシーは作らない
--   （reservation_addon_items と同じ方針）。
-- ------------------------------------------------------------
ALTER TABLE reservation_addon_cleanup_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservation_addon_cleanup_issues_admin_all" ON reservation_addon_cleanup_issues;
CREATE POLICY "reservation_addon_cleanup_issues_admin_all"
  ON reservation_addon_cleanup_issues
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "reservation_addon_cleanup_issues_business_admin_all" ON reservation_addon_cleanup_issues;
CREATE POLICY "reservation_addon_cleanup_issues_business_admin_all"
  ON reservation_addon_cleanup_issues
  FOR ALL
  TO authenticated
  USING (is_business_admin() AND can_manage_business(business_id))
  WITH CHECK (is_business_admin() AND can_manage_business(business_id));

-- staff: SELECT のみ（UPDATE は business_admin 以上、Part 1と同じ非対称方針）
DROP POLICY IF EXISTS "reservation_addon_cleanup_issues_staff_select" ON reservation_addon_cleanup_issues;
CREATE POLICY "reservation_addon_cleanup_issues_staff_select"
  ON reservation_addon_cleanup_issues
  FOR SELECT
  TO authenticated
  USING (is_staff() AND can_manage_business(business_id));

-- ------------------------------------------------------------
-- GRANT
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON reservation_addon_cleanup_issues TO authenticated;

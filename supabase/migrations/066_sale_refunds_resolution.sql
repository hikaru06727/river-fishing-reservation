-- ============================================================
-- Migration 066: sale_refunds 失敗時の要対応トラッキング
--
-- 背景:
--   cancelReservation() の技術的負債整理の一環。Stripe 返金失敗時の
--   挙動は「キャンセル自体は進める」を維持する方針としたが、現状は
--   sale_refunds に status='failed' の行が記録され console.error が
--   出るのみで、検知・追跡の手段が管理画面上に存在しない。
--
--   本 migration では新しいステータスやワークフローは追加せず、
--   既存の status='failed' 行に対して「対応済みにした」という事実だけを
--   記録できるようにする（resolved_at / resolved_by / resolution_note）。
--   status 自体は 'failed' のまま変えない
--   （実際に Stripe 側で再返金が成功したわけではないため、
--    ステータスを 'completed' に書き換えるのは事実と異なる）。
--
-- 変更内容:
--   1. sale_refunds.resolved_at / resolved_by / resolution_note を追加
--   2. 未対応の失敗返金を高速に絞り込むための部分インデックスを追加
--   3. RLS: 解決操作(UPDATE)は admin / business_admin のみ許可
--      （staff は sale_refunds に対して SELECT + INSERT のみの既存方針を維持）
-- ============================================================

ALTER TABLE sale_refunds
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

COMMENT ON COLUMN sale_refunds.resolved_at IS
  '失敗した返金（status=failed）に対して、管理者が手動対応を完了させた日時。
   status 自体は failed のまま維持し、対応済みかどうかはこのカラムの有無で判定する。';
COMMENT ON COLUMN sale_refunds.resolved_by IS '対応済みにした管理者の profiles.id';
COMMENT ON COLUMN sale_refunds.resolution_note IS '手動対応の内容メモ（任意）';

-- 「事業ごとの未対応の失敗返金」を管理画面で一覧表示する際に使う部分インデックス
CREATE INDEX IF NOT EXISTS idx_sale_refunds_unresolved_failed
  ON sale_refunds (business_id, refunded_at DESC)
  WHERE status = 'failed' AND resolved_at IS NULL;

-- ------------------------------------------------------------
-- RLS: 解決操作は admin / business_admin のみ。
--   既存の sale_refunds_admin_all / sale_refunds_business_admin_all
--   ポリシーは FOR ALL のため UPDATE も既に許可されている。
--   staff 向けの UPDATE ポリシーは元々存在しないため追加不要
--   （sale_refunds_staff_select / sale_refunds_staff_insert のみ）。
-- ------------------------------------------------------------

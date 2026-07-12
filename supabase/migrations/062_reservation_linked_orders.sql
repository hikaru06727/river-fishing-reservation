-- ============================================================
-- Migration 062: 予約後の追加購入（Phase 19E）
--
-- 背景:
--   予約後に別会計として online_orders（Phase 19B/19C の物販ECサイト
--   注文）を追加購入できるようにする。Phase 19D の reservation_addon_items
--   （予約と一体の会計・同一 reservation の明細）とは異なり、本 Phase の
--   追加購入は online_orders 自身のライフサイクル（決済・返金・売上集計）
--   を完全に維持したまま、予約とのリンク情報のみを追加する。
--
-- 変更内容:
--   1. online_orders.linked_reservation_id 追加
--      （予約キャンセル時にこの注文を自動処理しないため ON DELETE RESTRICT。
--       reservations の物理削除は createReservationAtomic 失敗時の
--       ロールバック専用パスのみで、顧客に露出する前の予約にしか発生しない
--       ため実質的に発火しないが、想定外の削除経路が将来追加された場合に
--       サイレントに孤立させず検知できるよう RESTRICT を選ぶ）
--   2. online_orders.stripe_payment_intent_id 追加
--      （payments テーブルと同じパターン。webhook の checkout.session.completed
--       時点で session.payment_intent を保存し、返金時に Stripe API を
--       呼び直す/lookup する必要をなくす）
--   3. sale_refunds.online_order_id 追加 + 3方向 CHECK 制約への拡張
--      （sale_session_id / reservation_id / online_order_id のうち
--       厳密に1つのみ NOT NULL）
--
-- 注記:
--   businesses RLS の修正（ログイン済み一般顧客が事業を閲覧できないバグ）は
--   本 Phase の実装過程で発見したが、影響範囲がアクセス制御全体に及ぶ独立した
--   変更のため、本 migration には含めず migration 063 として分離した。
-- ============================================================

-- ------------------------------------------------------------
-- 1. online_orders.linked_reservation_id
-- ------------------------------------------------------------
ALTER TABLE online_orders
  ADD COLUMN IF NOT EXISTS linked_reservation_id UUID REFERENCES reservations(id) ON DELETE RESTRICT;

COMMENT ON COLUMN online_orders.linked_reservation_id IS
  '予約後の追加購入の場合に紐づく予約ID（Phase 19E）。あくまでメタデータであり、
   注文自体の決済・返金・ステータス遷移・売上集計は予約から完全に独立して行われる。
   予約キャンセル時にこの注文を自動キャンセル/自動返金する処理は一切ない。';

CREATE INDEX IF NOT EXISTS idx_online_orders_linked_reservation_id
  ON online_orders (linked_reservation_id)
  WHERE linked_reservation_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. online_orders.stripe_payment_intent_id
-- ------------------------------------------------------------
ALTER TABLE online_orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

COMMENT ON COLUMN online_orders.stripe_payment_intent_id IS
  'Stripe Checkout Session 完了時（webhook）に記録する payment_intent ID。
   カード返金時にこれを使う（配送=Stripeのみ、店舗受け取り=現地決済のため常にNULL）。';

-- ------------------------------------------------------------
-- 3. sale_refunds.online_order_id + CHECK 制約拡張
-- ------------------------------------------------------------
ALTER TABLE sale_refunds
  ADD COLUMN IF NOT EXISTS online_order_id UUID REFERENCES online_orders(id) ON DELETE RESTRICT;

COMMENT ON COLUMN sale_refunds.online_order_id IS
  'online_orders への返金の場合に設定する（Phase 19E）。sale_session_id / reservation_id とは排他。';

CREATE INDEX IF NOT EXISTS idx_sale_refunds_online_order_id
  ON sale_refunds (online_order_id);

ALTER TABLE sale_refunds
  DROP CONSTRAINT IF EXISTS sale_refunds_sale_or_reservation;

ALTER TABLE sale_refunds
  ADD CONSTRAINT sale_refunds_sale_or_reservation_or_order CHECK (
    (sale_session_id IS NOT NULL AND reservation_id IS NULL     AND online_order_id IS NULL) OR
    (sale_session_id IS NULL     AND reservation_id IS NOT NULL AND online_order_id IS NULL) OR
    (sale_session_id IS NULL     AND reservation_id IS NULL     AND online_order_id IS NOT NULL)
  );

-- ------------------------------------------------------------
-- 4. GRANT
--    online_orders は既存 GRANT (055) で SELECT/INSERT/UPDATE 済み。
--    sale_refunds は既存 GRANT (043) で SELECT/INSERT/UPDATE 済み。
--    追加カラムのみのため GRANT の変更は不要。
-- ------------------------------------------------------------

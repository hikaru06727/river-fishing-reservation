-- ============================================================
-- SQL Editor ブロック 5a / 10
-- 005: カラム COMMENT + slot_capacity_status ビュー
-- （既存テーブル・データは変更しません）
-- ============================================================

COMMENT ON COLUMN fishing_spots.capacity IS
  '釣り場マスタ定員。availability_slots 生成時のデフォルト参考値。ランタイム予約判定には不使用。将来 sync_spot_capacity(spot_id, capacity, from_date) で未来枠の max_capacity を同期する RPC を追加する想定。';

COMMENT ON COLUMN availability_slots.max_capacity IS
  'hourly スロットの定員上限。remaining_count = min(max_capacity - booked_count) の唯一のソース。';

COMMENT ON COLUMN availability_slots.booked_count IS
  'pending + confirmed の合計占有数。create_reservation_atomic で増加、expired/cancelled で減算。';

CREATE OR REPLACE VIEW slot_capacity_status AS
SELECT
  s.id,
  s.spot_id,
  s.slot_date,
  s.start_time,
  s.end_time,
  s.status,
  s.max_capacity,
  s.booked_count,
  GREATEST(s.max_capacity - s.booked_count, 0) AS remaining_count
FROM availability_slots s;

COMMENT ON VIEW slot_capacity_status IS
  'hourly スロットの定員・占有・残枠一覧。remaining_count = max_capacity - booked_count（0 未満は 0 に丸め）';

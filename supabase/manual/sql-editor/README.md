# Supabase SQL Editor 手動適用ガイド

`supabase db push` が 003 で失敗した場合、以下の順番で **1ファイルずつ** SQL Editor に貼り付けて実行してください。

**前提:** 001 / 002 は適用済み。テーブル・データの削除は不要。

## 実行順序

| 順番 | ファイル | 内容 |
|------|---------|------|
| 1 | `01_create_reservation_atomic.sql` | 003: 予約作成 RPC（暫定版） |
| 2 | `02_cancel_reservation_atomic.sql` | 003: キャンセル RPC |
| 3 | `03_grants_comments_rpc.sql` | 003: GRANT / REVOKE / COMMENT |
| 4a | `04a_index_pending_reservations.sql` | 004: 部分インデックス |
| 4b | `04b_get_affected_slot_ids_for_reservation.sql` | 004: ヘルパー関数 |
| 4c | `04c_expire_pending_reservations.sql` | 004: 失効 RPC |
| 4d | `04d_grants_comments_expire.sql` | 004: GRANT / COMMENT |
| 4e | `04e_pg_cron_schedule.sql` | 004: pg_cron ジョブ（任意・拡張有効時のみ） |
| 5a | `05a_capacity_comments_and_view.sql` | 005: カラム COMMENT + ビュー |
| 5b | `05b_create_reservation_atomic_final.sql` | 005: **create_reservation_atomic 最終版** |
| 6 | `06_verify.sql` | 実行後確認 |

## 注意

- **5b を必ず最後に実行**してください（005 が 003 の create を上書きします）。
- 003 の 1 と 5b の両方が必要です（1 → … → 5b の順）。
- pg_cron 未有効化の場合、4e は NOTICE のみ出て終了します。Dashboard > Database > Extensions で pg_cron を有効化してから 4e を再実行してください。

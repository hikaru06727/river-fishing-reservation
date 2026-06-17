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
| **006 系列** | | **事業別管理者（006_business_admin_rls.sql）** |
| 6a | `006a_businesses_table.sql` | businesses テーブル |
| 6b | `006b_fishing_spots_business_id.sql` | fishing_spots.business_id |
| 6c | `006c_business_admin_assignments.sql` | 担当割当テーブル |
| 6d | `006d_profiles_role_business_admin.sql` | role CHECK 拡張 |
| 6f | `006f_seed_business_spot_links.sql` | 既存釣り場の事業紐づけ |
| 6g | `006g_rls_helper_functions.sql` | RLS helper 関数 |
| 6h | `006h_rls_policies_business_admin.sql` | RLS ポリシー |
| 6i | `006i_verify_business_admin.sql` | 確認 SQL |

## 006 実行順序

**006a → 006b → 006c → 006d → 006f → 006g → 006h → 006i**（1 ファイルずつ）

- **006e はスキップ**（006f が seed 兼ねる）
- 007 RLS hardening 未適用の DB でも 006h は DROP IF EXISTS で適用可能

## 注意

- **5b を必ず最後に実行**してください（005 が 003 の create を上書きします）。
- 003 の 1 と 5b の両方が必要です（1 → … → 5b の順）。
- pg_cron 未有効化の場合、4e は NOTICE のみ出て終了します。Dashboard > Database > Extensions で pg_cron を有効化してから 4e を再実行してください。

# Supabase 適用手順

## 方法 A: Supabase CLI（推奨）

```bash
# プロジェクトにリンク後
supabase db push
```

001〜008 の migration が順番通り適用されます。

## 方法 B: SQL Editor 手動適用

`supabase db push` が途中で失敗する場合は、[supabase/manual/sql-editor/README.md](../supabase/manual/sql-editor/README.md) に従い **1 ファイルずつ** 実行してください。

### Migration 一覧（001〜008）

| # | ファイル | 内容 |
|---|----------|------|
| 001 | `001_initial_schema.sql` | テーブル・初期スキーマ |
| 002 | `002_rls_policies.sql` | RLS ポリシー |
| 003 | `003_atomic_reservation_rpc.sql` | 予約・キャンセル RPC |
| 004 | `004_expire_pending_reservations.sql` | pending 自動失効 + pg_cron |
| 005 | `005_capacity_management.sql` | 定員管理・create RPC 最終版 |
| 006 | `006_business_admin_rls.sql` | business_admin・RLS |
| 007 | `007_harden_rls.sql` | RLS hardening |
| 008 | `008_add_cash_payment_method.sql` | `payment_method`・現金精算 |

### 008 手動分割（SQL Editor）

| 順番 | ファイル |
|------|----------|
| 1 | `008a_add_payment_method_to_reservations.sql` |
| 2 | `008b_update_expire_pending_reservations.sql` |
| 3 | `008c_update_create_reservation_atomic.sql` |
| 4 | `008d_verify_cash_payment_method.sql` |

## Seed データ

```sql
-- supabase/seed.sql を SQL Editor で実行
```

本番では seed の代わりに管理画面または SQL でマスタ（釣り場・プラン・枠）を投入してください。

## pg_cron（pending 自動失効）

1. Supabase Dashboard → Database → Extensions → **pg_cron** を有効化
2. `004e_pg_cron_schedule.sql` を実行（または migration 004 適用済みなら再実行）
3. 5 分間隔で `expire_pending_reservations()` が実行される

確認:

```sql
SELECT * FROM cron.job WHERE jobname = 'expire-pending-reservations';
```

## 管理者アカウント

1. Supabase Auth でユーザーを作成（またはアプリからサインアップ）
2. SQL Editor で role を設定:

```sql
UPDATE profiles SET role = 'admin' WHERE id = '<user-uuid>';
```

3. business_admin の場合:

```sql
UPDATE profiles SET role = 'business_admin' WHERE id = '<user-uuid>';

INSERT INTO business_admin_assignments (user_id, business_id)
VALUES ('<user-uuid>', '<business-uuid>');
```

## 適用後の確認

```sql
-- RLS 有効
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('reservations', 'payments', 'profiles');

-- payment_method カラム（008 後）
SELECT column_name FROM information_schema.columns
WHERE table_name = 'reservations' AND column_name = 'payment_method';

-- RPC 存在
SELECT proname FROM pg_proc
WHERE proname IN ('create_reservation_atomic', 'cancel_reservation_atomic', 'expire_pending_reservations');
```

## service_role キーの扱い

- Supabase Dashboard → Settings → API → `service_role` key
- **Vercel / サーバー環境の Secret のみ**に設定
- ブラウザ・`NEXT_PUBLIC_*` には絶対に含めない

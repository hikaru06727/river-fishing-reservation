# 管理者向け運用手順

## ロール

| role | 権限 |
|------|------|
| `admin` | 全事業・全予約の閲覧・操作 |
| `business_admin` | `business_admin_assignments` で紐づいた事業の予約のみ |
| `user` | 一般ユーザー（管理画面不可） |

権限の Single Source of Truth は `profiles.role` です。アプリ middleware と RLS の両方でチェックされます。

## ログイン

- URL: `/admin/login`
- Supabase Auth（メールリンク）でログイン
- 管理ロール以外は `/` にリダイレクト

## 日常操作

### ダッシュボード `/admin`

- 今日・今後の予約件数
- ロール表示（admin / 担当事業名）

### 予約一覧 `/admin/reservations`

- フィルタ: ステータス、日付、日付範囲、釣り場
- business_admin は担当事業の予約のみ表示

### 予約詳細 `/admin/reservations/[id]`

| 操作 | 条件 |
|------|------|
| キャンセル | 管理権限 + キャンセル可能なステータス |
| 現地で支払い済みにする | `payment_method=cash_at_venue` かつ `payments.status=pending` |

## 現金精算フロー

1. ユーザーが「当日現地で現金」で予約 → 即 `confirmed`
2. `payments` レコードは `pending`（現地未収）
3. 当日現地で受け取り後、管理画面で「現地で支払い済みにする」
4. `payments.status=succeeded`, `paid_at` 設定（**メールは送信しない**）

## 管理者アカウントの初回作成

本番では `/api/admin/set-role` は **無効**（`NODE_ENV=production`）。

1. ユーザーが通常サインアップ
2. Supabase SQL Editor で role 更新（[Supabase 適用手順](./supabase-setup.md) 参照）
3. business_admin の場合は `business_admin_assignments` に INSERT

## 開発環境での role 変更

`ADMIN_SECRET` を設定した場合のみ:

```bash
curl -X POST http://localhost:3000/api/admin/set-role \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"userId":"<uuid>","role":"admin"}'
```

## 通知メール

- 新規予約・決済完了・キャンセル時に admin / 担当事業の business_admin へ通知
- `ADMIN_NOTIFICATION_EMAIL` は admin ロールユーザーがいない場合のフォールバック
- business_admin は DB の `profiles.email` を使用

## トラブル時

| 事象 | 対応 |
|------|------|
| 担当外予約が見えない | business_admin_assignments を確認 |
| 現金「支払い済み」ボタンが出ない | payment_method / payments.status を確認 |
| Webhook 後も pending | Stripe Dashboard → Webhooks の delivery ログ |

# 本番公開前チェックリスト

川釣り予約サービスを本番公開する前に確認する項目一覧です。  
**チェックボックスはデプロイ前の手動確認用**です（リポジトリ内では未チェックのまま維持）。

---

## 1. 環境変数

詳細は [環境変数一覧](./env-vars.md) を参照。

### 必須（本番）

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — Supabase プロジェクト URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — ブラウザ・サーバー共通（公開可）
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — **サーバーのみ**。Vercel 等の Secret に設定、クライアントに露出しない
- [ ] `STRIPE_SECRET_KEY` — 本番は `sk_live_...`
- [ ] `STRIPE_WEBHOOK_SECRET` — Stripe Dashboard の Webhook エンドポイント用 `whsec_...`
- [ ] `NEXT_PUBLIC_APP_URL` — 本番 URL（末尾スラッシュなし）。Checkout の success/cancel URL・メールリンクに使用

### メール（本番で通知する場合）

- [ ] `EMAILS_ENABLED=true`
- [ ] `RESEND_API_KEY`
- [ ] `MAIL_FROM` — Resend で検証済みドメインのアドレス
- [ ] `ADMIN_NOTIFICATION_EMAIL` — 全体 admin 向け通知のフォールバック先（任意だが推奨）

### 本番で設定しない / 注意

- [ ] `ADMIN_SECRET` — **本番では未設定推奨**（`/api/admin/set-role` 等は production では無効だが、念のため Secret に載せない）
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — 現行実装では未使用（Stripe Checkout リダイレクト方式）

### 設定漏れしやすい項目

| 変数 | 漏れた場合の症状 |
|------|------------------|
| `NEXT_PUBLIC_APP_URL` | Checkout 後 localhost にリダイレクト、メールリンクが壊れる |
| `STRIPE_WEBHOOK_SECRET` | 決済完了しても予約が confirmed にならない（501/400） |
| `SUPABASE_SERVICE_ROLE_KEY` | 予約作成・Webhook・現金 payments 記録が失敗 |
| `EMAILS_ENABLED` 未設定 | メール送信スキップ（予約自体は成功） |
| `MAIL_FROM` 未検証 | Resend API エラー（ログに `[sendEmail]`） |

---

## 2. Supabase

手順詳細: [Supabase 適用手順](./supabase-setup.md)

- [ ] migration **001〜008** を順番通り適用済み
- [ ] `supabase/seed.sql` または本番用マスタデータ投入済み
- [ ] RLS が全対象テーブルで有効（001/002 + 006/007）
- [ ] `create_reservation_atomic` / `cancel_reservation_atomic` / `expire_pending_reservations` が存在
- [ ] **008 適用後**: `reservations.payment_method` カラム、`cash_at_venue` 対応 RPC
- [ ] pg_cron: `expire-pending-reservations` ジョブが 5 分間隔で動作（004e または Dashboard）
- [ ] `profiles.role` で admin / business_admin を手動設定済み
- [ ] `business_admin_assignments` に担当事業を紐づけ済み
- [ ] SQL Editor 手動適用時は [supabase/manual/sql-editor/README.md](../supabase/manual/sql-editor/README.md) の順序を厳守

### service_role 使用箇所（サーバーのみ）

| 用途 | ファイル |
|------|----------|
| 予約 RPC / payments 書き込み | `reservations.repository.ts`, `payments.repository.ts` |
| Stripe Checkout / Webhook | `api/checkout`, `api/webhooks/stripe` |
| 空き枠集計（RLS バイパス） | `slots.repository.ts` |
| 決済完了画面の表示 | `reserve/complete/page.tsx` |
| 管理者通知メール宛先解決 | `admin-notification-recipients.ts` |
| 開発用 admin API | `api/admin/set-role`, `set-password` |

- [ ] ブラウザの Network / Sources に `SUPABASE_SERVICE_ROLE_KEY` が含まれていないことを確認

---

## 3. Stripe

手順詳細: [Stripe 設定手順](./stripe-setup.md)

- [ ] 本番モードの API キーを Vercel Secret に設定
- [ ] Webhook エンドポイント: `https://<your-domain>/api/webhooks/stripe`
- [ ] 購読イベント: **`checkout.session.completed`** のみで可
- [ ] Webhook signing secret を `STRIPE_WEBHOOK_SECRET` に設定
- [ ] `NEXT_PUBLIC_APP_URL` が本番ドメインと一致

### 動作仕様（コード確認済み）

| 項目 | 期待動作 |
|------|----------|
| Checkout 作成 | `payment_method=online` かつ `status=pending` かつ `expires_at` 有効のみ |
| cash_at_venue | Checkout API が 422「現金精算の予約はオンライン決済できません」 |
| Webhook | `online` + `pending` のみ `confirmed` に更新 |
| cash Webhook | skip（`cash_at_venue_not_webhook_target`） |
| success_url | `{APP_URL}/reserve/complete?session_id={CHECKOUT_SESSION_ID}` |
| cancel_url | `{APP_URL}/reservation/confirm/{reservationId}` |

---

## 4. 予約フロー（手動 E2E）

### オンライン決済（online）

- [ ] ログイン → 釣り場 → プラン選択 → 予約フォーム
- [ ] 支払い方法「オンライン決済」を選択
- [ ] 予約後 `status=pending`、`expires_at` が約 30 分後
- [ ] 確認画面から「カード決済へ進む」→ Stripe Checkout
- [ ] 決済完了 → `/reserve/complete` → `status=confirmed`
- [ ] マイ予約に反映、決済完了メール（有効時）
- [ ] 30 分以内に未決済 → cron で `expired`、定員が戻る

### 当日現金精算（cash_at_venue）

- [ ] 支払い方法「当日現地で現金」を選択
- [ ] 予約直後 `status=confirmed`、`expires_at=NULL`
- [ ] Stripe Checkout ボタンが表示されない
- [ ] Checkout API を直接叩いても 422
- [ ] 予約確定メール（有効時）
- [ ] 管理画面で「現地で支払い済みにする」→ `payments.status=succeeded`

### キャンセル

- [ ] ユーザー: 利用開始前の confirmed 予約をキャンセル可能
- [ ] pending（online）もキャンセル可能
- [ ] キャンセル後定員が戻る
- [ ] キャンセルメール（有効時）

### 定員・複数人

- [ ] 残り人数を超える予約は RPC で拒否
- [ ] 同一枠への同時予約で定員超過しない（楽観ロック / RPC）
- [ ] 溿員時: 予約フォームに空き枠なし表示

---

## 5. 管理画面

詳細: [管理者向け運用手順](./admin-operations.md)

- [ ] `/admin/login` から admin / business_admin でログイン
- [ ] 一般 user は `/admin` にアクセス不可（トップへリダイレクト）
- [ ] admin: 全予約閲覧・操作
- [ ] business_admin: 担当事業の予約のみ
- [ ] 予約一覧: フィルタ（status, 日付, spotId）
- [ ] 予約詳細: キャンセル、現金「支払い済み」操作
- [ ] 担当外予約 URL → 403 / not found
- [ ] スマホ幅で一覧・詳細が読める

---

## 6. メール（Resend）

- [ ] 本番: `EMAILS_ENABLED=true`、API キー・MAIL_FROM 設定
- [ ] ドメイン DNS（SPF/DKIM）設定済み

| タイミング | 送信先 |
|------------|--------|
| online 仮予約 | ユーザー + admin/business_admin（予約受付メール） |
| online 決済完了 | ユーザー + admin/business_admin（Stripe 決済完了メール） |
| cash 予約確定 | ユーザー + admin/business_admin（予約受付メールのみ。決済完了メールは送らない） |
| cash 現地精算済み（管理画面操作） | **送信なし** |
| キャンセル | ユーザー + admin/business_admin |

**API キーなし / EMAILS_ENABLED=false の場合**: 送信スキップ（`ok: true, skipped: true`）。予約・決済処理は継続。

---

## 7. セキュリティ・運用

- [ ] HTTPS のみ（Vercel デフォルト）
- [ ] Supabase Auth: メールリンクログイン
- [ ] RLS + アプリ側 `canCurrentUserManage*` の二重防御を維持
- [ ] 本番ビルド成功: `npm run build`
- [ ] 型・テスト・Lint: `npm run typecheck`, `npm test`, `npm run lint`

---

## 8. ユーザー向け E2E 確認項目

公開前にステージングまたは本番で以下を通し確認:

1. 未ログインで `/my/*` → ログインへリダイレクト
2. 未ログインで予約 → ログイン後に予約画面へ戻る（`next` パラメータ）
3. 釣り場一覧 → 詳細 → プランから予約
4. online フルフロー（予約 → 決済 → 完了画面 → マイ予約）
5. cash フルフロー（予約 → 確認画面 → マイ予約、Checkout なし）
6. マイ予約詳細からキャンセル
7. pending 期限切れ後、マイ予約で expired 表示
8. 空き枠なし時のメッセージ表示
9. 決済エラー時（期限切れ等）の案内文言
10. スマホ表示（予約フォーム・確認・マイ予約）

---

## 9. 危険項目（未実装・要設計 — 実装前に要確認）

以下は**本番公開前に必須ではない**が、運用開始後に検討が必要な項目です。  
**DB / RLS / Stripe 仕様変更を伴うため、実装前に設計レビューが必要です。**

| 項目 | 概要 | 主なリスク |
|------|------|------------|
| Stripe 返金 | キャンセル時の自動返金 | payments / Stripe API / キャンセルポリシー連動 |
| キャンセルポリシー自動適用 | 前日不可等のルール強化 | RPC・UI・メール文言の一貫性 |
| 管理者・事業者 CRUD UI | Dashboard から role / assignment 管理 | RLS・権限昇格 |
| reservation_email_logs | 送信履歴テーブル | migration 追加 |
| ADMIN_SECRET 本番運用 | 緊急 role 変更 API | 認証・監査 |
| rate limiting | Checkout / 予約 API | インフラ or middleware 設計 |
| 監視・アラート | Webhook 失敗、cron 停止 | 運用設計 |
| ステージング環境 | 本番 DB 分離 | Supabase プロジェクト追加 |

---

## 10. デプロイ直前クイックチェック（5 分）

```
□ NEXT_PUBLIC_APP_URL = 本番 URL
□ STRIPE_WEBHOOK_SECRET = 本番 webhook
□ SUPABASE_SERVICE_ROLE_KEY = Secret のみ
□ migration 008 適用済み
□ pg_cron 動作確認
□ admin / business_admin アカウント作成済み
□ npm run build 成功
□ テスト決済 1 件成功（本番 or テストモード）
```

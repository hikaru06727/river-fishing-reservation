# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run test         # Run unit tests (Vitest)
npm run test:watch   # Unit tests in watch mode
npm run test:e2e     # E2E tests (Playwright, Chrome only)
npm run test:e2e:ui  # E2E tests with UI
```

Run a single unit test file: `npx vitest run src/lib/services/reservations.service.test.ts`

## Architecture

This is a Next.js 15 (App Router) + Supabase full-stack fishing reservation system.

### Layered Design

```
UI (pages/components) → Server Actions / Route Handlers
  → Services (src/lib/services/)      ← business logic, DB-agnostic
  → Repositories (src/lib/repositories/) ← Supabase abstraction layer
  → Supabase (PostgreSQL + RLS + Auth)
```

The Repository layer exists specifically to allow future migration away from Supabase to AWS RDS or さくらクラウド PostgreSQL. Services must only use Repository interfaces, never call Supabase directly. UI components must only reference `domain.ts` types, never Supabase/database types.

### Type Separation (important)

- `src/types/domain.ts` — Application types used by UI and Services (`ReservationStatus`, `UserProfile`, `PlanSummary`, etc.)
- `src/types/database.ts` — Supabase schema types (Row types, RPC results) — only Repositories reference these
- `src/types/api.ts` — HTTP DTO types for API routes

### Key Directories

- `src/app/` — Next.js App Router pages grouped by role: `(admin)/`, `(auth)/`, `(public)/`, `(user)/`
- `src/actions/` — Server Actions for mutations (blog, catch, reservation)
- `src/lib/` — Business logic organized by domain: `auth/`, `business-hours/`, `email/`, `plans/`, `reservations/`, `repositories/`, `services/`, `slots/`, `spots/`, `stripe/`, `supabase/`
- `src/components/` — React components grouped by domain
- `src/validations/` — Zod schemas for all request boundaries
- `supabase/migrations/` — 63 sequential SQL migration files (DDL, RPC functions, RLS policies)
- `docs/` — Operational docs: architecture, schema, env vars, Stripe/email setup

### Reservation Flow

Two payment paths create different initial states:
- **Online (Stripe)**: `pending` reservation created with 30-minute expiry → Stripe Checkout redirect → webhook fires to confirm → status becomes `confirmed`
- **Cash**: `confirmed` reservation created immediately, no expiry

Atomic PostgreSQL RPC functions handle slot capacity updates to prevent race conditions under concurrent bookings.

### Authorization (Two Layers)

1. **PostgreSQL RLS** — enforced at the database level for all queries
2. **Middleware** (`src/middleware.ts`) + `src/lib/auth/management-access.ts` — route-level protection in the application

Roles: `user`, `admin`, `business_admin`, `staff`. Routes `/admin/*` and `/my/*` are middleware-protected.

### Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Environment

Copy `.env.example` to `.env.local`. Required services: Supabase, Stripe, Resend (email). See `docs/env-vars.md` for all variables and `docs/supabase-setup.md` / `docs/stripe-setup.md` for local setup.

Stripe webhooks require `stripe listen --forward-to localhost:3000/api/webhooks/stripe` running locally.

## 作業完了時のルール

全ての作業が完了したとき、または承認・確認が必要で一時停止するときは必ず以下のコマンドを実行してください。

完了時（2回）：
```powershell
[Console]::Beep(1000, 300); Start-Sleep -Milliseconds 100; [Console]::Beep(1000, 300)
```

承認待ち（3回）：
```powershell
[Console]::Beep(800, 300); Start-Sleep -Milliseconds 100; [Console]::Beep(800, 300); Start-Sleep -Milliseconds 100; [Console]::Beep(800, 300)
```

## 現在の作業
Phase 20：顧客アカウント機能（完了）

実装済み：
- 認証方式をマジックリンクからメール＋パスワードに変更（`signInWithPassword` / `signUp`）。`/login`, `/signup` はパスワード方式のみ表示
- `/admin/login` を廃止し、管理者ログインを `/login` に統合。`login()`（`src/app/(auth)/actions.ts`）がログイン成功後に `profiles.role` を判定し、管理系ロール（`isManagementRole`）なら `/admin/reservations`（または `next` が `/admin` 始まりならその `next`）へ、一般顧客なら従来通り `safeNextPath(next)` へリダイレクト
- パスワードリセットフロー（`resetPasswordForEmail` → `/login/reset` → `/login/reset/confirm`）
- signup確認メールのエラーハンドリング強化（`/auth/callback` でリンク期限切れ／使用済み／不明を判定、確認メール再送導線）
- `online_orders.user_id`（migration 064）+ RLS（`online_orders_owner_select`）で注文にログインユーザーを紐付け
- `/my/orders`（一覧）・`/my/orders/[id]`（詳細）ページ新設
- `profiles` に住所・電話番号カラム追加（migration 065）。チェックアウト時に自動入力し、「この住所を今後のために保存する」チェック（デフォルトON）で明示的に保存
- migration 064・065 は dev/共有Supabaseプロジェクトへ適用済み

次のPhase未定。

## 既知の技術的負債

- `cancelReservation()`（`src/lib/services/reservations.service.ts`）のキャンセル時自動返金＋アドオン後処理（在庫復元・明細cancelled化・payment_ledger更新）は、Stripe返金APIを含む複数ステップにまたがるがDBトランザクションで結ばれておらず、返金成功後にアドオン後処理だけが丸ごと失敗すると在庫・帳簿の不整合が残り得る（検知手段はconsole.errorのログのみ、自動リトライ・管理画面アラート無し）。完全なアトミック性保証は未着手。この非アトミック性に起因する具体例として、e2e/reservation-addon-flow.spec.ts で Stripe自動返金後の payment_ledger 更新待ち（アドオン明細行の refunded 遷移確認、テストコード内 line 262 付近）がタイムアウトすることがある。Phase 20の検証時に4回連続実行して1回発生を確認済み（2026年7月、認証方式変更とは無関係と切り分け済み）。発生頻度は変動しうるため、次にこの負債を解消する際の実地検証課題として記録する。2026年7月の追加調査：合計16回実行し失敗は1回のみ（発生率は低い）。ただし、devサーバー起動直後の12回では0回、長時間稼働後の状態で1回発生しており、サーバーの累積負荷・レスポンス遅延が発生条件に関与している可能性がある。失敗時のサーバーログを直接捕捉できておらず、タイミング遅延によるものか cancelAddonItemsAndRestoreStock() 自体の処理失敗かは未確定のまま。
- Supabase Authのメール送信（signup確認・パスワードリセット）はSupabase標準メーラーを使用しており、カスタムSMTP未設定のためレート制限が低い（Phase 20のE2E検証中に signup を連続実行し `email rate limit exceeded` を確認）。本番運用前にSupabase側でカスタムSMTPの設定を検討する必要がある（`docs/email-setup.md` にも「Supabase Auth OTPは別系統」の記載あり、Phase 20固有の新規債務ではないが未対応のまま残っている）。
- ログイン画面の「初めてログインする方」向け文言は、現状本番環境が存在せず既存アカウントも0件のため、その問題自体が発生しえない状態。文言を削除してサイトをシンプルに（2026年7月）。将来、本番投入前に旧方式（マジックリンク）ユーザーが実在する状態が生じる場合は、この移行導線の再実装を検討すること。
- npm run build がリポジトリ全体で失敗する状態にある。原因は @typescript-eslint/no-explicit-any（as any の使用、主にテストファイルのSupabaseクライアントモックパターン）が約12ファイルで検出されるため。typecheck / test / test:e2e はこれまで通りパスしており、日常の開発フローには影響しないが、本番デプロイ（Vercel等のbuildを要する環境）の前には必ず対応が必要（2026年7月、Phase 20検証中にnpm run build実行時に偶然発見）。対応案: eslint.config.mjsにテストファイル向けのoverrides（*.test.ts等でno-explicit-anyをwarn化 or 対象外）を追加するか、該当箇所を型安全なモックヘルパーに置き換える。
  → **対応済み**（2026年7月）。eslint.config.mjsにテストファイル向けoverrides（`**/*.test.ts`, `**/*.test.tsx`でno-explicit-anyを無効化）を追加し、対象7ファイル（src/lib/repositories/*.repository.test.ts）のエラーを解消。あわせてadmin/products/sales/page.tsxのprefer-const 1件も修正。npm run build / typecheck / test すべて成功を確認済み。
- /shop/[slug]/order-complete（Phase 19C、注文完了ページ）は、ゲスト注文対応のため意図的に未ログインでもorder_id（UUID）のみでアクセス可能な設計。ただしこのページには店舗受け取り時の本人確認用confirmation_codeも表示されるため、order_idが第三者に渡った場合（URLの誤共有・ブラウザ履歴の覗き見等）、そのコードを使って本人以外が受け取りを詐称できる可能性が理論上ある。2026年7月、Phase 20の手動検証中に発見（Phase 20自体の不具合ではない）。対応要否は今回判断せず記録のみ。
- customer-account.spec.ts のsignupテストで、テスト用ドメイン e2e-test-mail.com がメール送信時に無効なアドレスとして拒否される事象を確認（2026年7月、管理者ログイン統合の検証中に発見）。Supabase標準メーラーのレート制限（既存の別項目）とは異なる環境要因。対応: テスト用メールドメインを実在するメールプロバイダのサブアドレス方式（例: 実アドレス+タグ）に変更するか、Supabase側でこのドメインを許可リストに追加できるか確認する。
- createStripeCheckoutSessionForOrder()（online-order.service.ts）で、注文合計金額がStripeのJPY決済最低額（¥50）を下回る場合、Stripeがamount_too_smallエラーを返し、ユーザーには原因不明な「決済ページの作成に失敗しました」というメッセージのみが表示される。2026年7月、Phase 20の手動検証中に低額テストデータで発生を確認（Phase 20自体の不具合ではない）。対応案: createOrder()側で¥50未満の場合に決済方法選択前にバリデーションエラーを出す、またはエラーメッセージを金額起因と分かる内容に変更する。実運用での発生可能性は低い（通常の商品単価では起こりにくい）が、エラーメッセージの分かりにくさは改善の余地がある。
- 事業（business）削除時、locations.business_id が ON DELETE SET NULL によりNULL化されるため、それ以降そのlocationに紐づく予約をキャンセルすると、autoRefundReservationOnCancel および cancelAddonItemsAndRestoreStock 双方で businessId が取得できず、返金処理・アドオン後処理失敗の記録がともにスキップされる（console.errorのみで、管理画面上での検知手段がない）。locations作成時にbusiness_idが必須入力になっていない可能性も合わせて要確認。対応要否・優先度は未判断。（2026年8月、cancelAddonItemsAndRestoreStock()のアドオン後処理失敗トラッキング機能実装前のスキーマ確認中に発見）
  なお processExpirePendingReservations()（pending予約の自動失効バッチ）経由の cancelAddonItemsAndRestoreStock() 呼び出しは、意図的に businessId: null を渡している。この経路はStripe Webhook到達前の予約のみが対象のため、構造上③payment_ledger更新・②在庫復元は発生せず、①明細cancelled化の失敗のみがリスク対象（金銭的リスクではなくデータ不整合リスク）。そのため cleanup issue 記録の対象外としている（2026年8月、Part 2実装中に判断）。
- getPaymentStateColor()（src/lib/reservations/payment-method.ts 92-108行目）で、"済"を含む文字列を一括で緑色（成功色）にする判定が広すぎるため、"キャンセル済"（支払いが成功したわけではない）も緑色で表示されてしまう。customer-self-cancel.spec.ts のE2Eテスト作成中（2026年8月）に発見。また同関数内の "返金済" 等の個別チェックは、この汎用チェックより後にあるため実質デッドコードになっている。対応要否・優先度は未判断。
- E2Eテスト全体（fullyParallel: true）で、複数のspecファイルが同一のテスト用ユーザー（E2E_TEST_USER_EMAIL）を共有してloginAsTestUser()を呼んでいるため、異なるファイル・テストが並列実行されるタイミングで、Supabase側のマジックリンク発行が互いを無効化し合い、"Email link is invalid or has expired" でログインが失敗することがある（2026年8月、customer-self-cancel.spec.ts作成中に発見・再現確認済み。--workers=1では発生せず、並列時のみ発生することを確認）。影響しうるファイル: customer-account.spec.ts, customer-self-cancel.spec.ts, reservation-addon-flow.spec.ts, reservation-linked-order-flow.spec.ts（いずれもE2E_TEST_USER_EMAILを共有）。reservation-addon-flow.spec.ts で以前確認されていた16回中1回のタイムアウト事例（技術的負債1番、cancelReservation()のアトミック性問題として記録済み）とは失敗時のエラー内容が異なる（タイムアウト vs ログイン401エラー）ため、直接の同一原因とは断定できないが、断続的に失敗する点は類似しており、テスト環境のflakinessの一因として関連する可能性がある。対応案（未着手）: ファイル単位でのserial化に加え、テスト用アカウントを複数用意する、または /api/test/login 側でトークンの相互無効化を回避する設計に変更する等。優先度・対応要否は未判断。

## 今後の大方針転換（未着手・要計画）
2026年8月、マルチテナントSaaS化の方針を撤回し、単一事業者向けの
釣り体験予約システムとして運用する方針に転換した。

影響範囲が非常に大きいため、別セッションで計画的に着手すること。
主な影響箇所（要調査・要設計）：
- businesses テーブル・全RLSポリシー（can_manage_business()関数、
  各テーブルのbusiness_admin_allポリシー群）
- staff_membersの事業割当、business_adminロールの扱い
- /admin配下の事業選択UI（businessIdクエリパラメータ、
  findManageableBusinesses()等）
- locations.business_id、plans.location_idの事業紐付け
- sale_refunds/reservation_addon_cleanup_issuesのbusiness_id列と
  RLS（Part 1・Part 2で追加）

方針決定が必要な論点（着手時に検討）：
- DBスキーマからbusiness_id自体を除去するか、
  「常に1事業のみ存在する」前提で残すか（後者の方が変更コストは低い）
- 既存のRLSをどこまで単純化するか
- POST /api/reservations 等、他の未使用公開APIルートも
  同様の理由で整理対象になりうる（今回のcancel route削除と同じ論点）

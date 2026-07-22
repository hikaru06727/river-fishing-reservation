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

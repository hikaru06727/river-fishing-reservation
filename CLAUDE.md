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

Run a single unit test file: `npx vitest run src/lib/services/reservation.test.ts`

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
- `supabase/migrations/` — 21 sequential SQL migration files (DDL, RPC functions, RLS policies)
- `docs/` — Operational docs: architecture, schema, env vars, Stripe/email setup

### Reservation Flow

Two payment paths create different initial states:
- **Online (Stripe)**: `pending` reservation created with 30-minute expiry → Stripe Checkout redirect → webhook fires to confirm → status becomes `confirmed`
- **Cash**: `confirmed` reservation created immediately, no expiry

Atomic PostgreSQL RPC functions handle slot capacity updates to prevent race conditions under concurrent bookings.

### Authorization (Two Layers)

1. **PostgreSQL RLS** — enforced at the database level for all queries
2. **Middleware** (`middleware.ts`) + `lib/auth/management-access.ts` — route-level protection in the application

Roles: `user`, `admin`, `business_admin`. Routes `/admin/*` and `/my/*` are middleware-protected.

### Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Environment

Copy `.env.example` to `.env.local`. Required services: Supabase, Stripe, Resend (email). See `docs/env-vars.md` for all variables and `docs/supabase-setup.md` / `docs/stripe-setup.md` for local setup.

Stripe webhooks require `stripe listen --forward-to localhost:3000/api/stripe/webhook` running locally.

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
Phase 13A：repository層・service層・管理画面UIの実装

実装済み（DB設計完了）：
- tax_rates テーブル（migration 024）
- payments.status 拡張（migration 025）
- refunds テーブル（migration 026）
- manual_sales テーブル（migration 027）
- reservations.tax_rate_percent（migration 028）

次に実装する内容：
- manual_sales の repository / service 層
- 管理画面から手動売上を登録・一覧・編集・削除できるUI
- 予約作成時に tax_rate_percent をスナップショット保存する処理
- unified_sales_view（予約売上＋手動売上の統合VIEW）

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

## 現在の作業
Phase 12B：汎用カラム追加＋設計整理

次に以下を実装してください。

【実装方針】
- 既存データへの破壊的変更なし
- 既存コードを壊さず追加のみ
- repository層を通す

【作業内容】
1. migration 023を作成し、locationsテーブルに以下を追加
   - category カラム（TEXT, DEFAULT 'fishing'）
     CHECK: fishing / camping / cafe / salon / rental_space / experience / retail / other
   - booking_type カラム（TEXT, DEFAULT 'time_slot'）
     CHECK: time_slot / seat / resource / staff
   - 既存データは全て category='fishing', booking_type='time_slot' になるので互換性あり

2. src/types/database.ts の locations テーブル型に上記2カラムを追加

3. typecheck と test を実行して結果を報告してください

# アーキテクチャ

Next.js App Router + Supabase (PostgreSQL + Auth) + Stripe + Resend。

将来の DB 移行（AWS RDS / さくらクラウド PostgreSQL 等）を見据え、**Supabase 依存は Repository / Auth Adapter に閉じ込める**方針。

詳細設計: [db-migration-design.md](./db-migration-design.md)

---

## レイヤ構成（目標）

```
┌─────────────────────────────────────────────────────────┐
│  UI (app/, components/)                                 │
│  - domain 型のみ参照                                    │
│  - Supabase クライアント禁止                            │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Actions / Route Handlers                                 │
│  - 薄い入口。Service を呼ぶ                             │
│  - Stripe Webhook 等は Repository 経由へ移行予定         │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Service (lib/services/)                                  │
│  - ビジネスロジック・バリデーション・メール起票          │
│  - DB 非依存（Repository interface 経由）               │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Repository (lib/repositories/)  ← Supabase 依存を閉じる │
│  - .from / .rpc の唯一の正規出口（目標）                 │
│  - Row 型 ↔ domain 型の変換                             │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Auth Adapter (lib/auth/)                               │
│  - getSession / getUser / getProfile                      │
│  - Supabase Auth → AuthUser 変換                          │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  PostgreSQL (+ RLS) / Supabase Auth                     │
└─────────────────────────────────────────────────────────┘
```

---

## 現状（2025-06 時点）

| レイヤ | 状態 |
|--------|------|
| Service | 予約・決済・枠は Repository 経由。**良好** |
| Repository | 4 ファイル存在。予約 RPC は集約済み |
| Auth | `get-user.ts` に Supabase 直結。middleware も直結 |
| Query helpers | `get-*-reservations.ts`, `get-spots.ts` 等が **Repository 外**で `.from` |
| Route / Page | blog/catches API・ページ、Stripe webhook が **Repository 外**で DB アクセス |
| Cron | `expire_pending_reservations` は **DB 内 pg_cron のみ**。アプリコードから未呼び出し |

---

## 主要フロー

### オンライン予約

1. ReserveForm → `createReservationAction` → `reservations.service`
2. Service → `createReservationAtomic` (RPC via Repository)
3. 確認画面 → `/api/checkout` → Stripe
4. Webhook → `confirmed` + payments upsert
5. pg_cron → pending 失効（アプリ外）

### 現金予約

1. 同上だが RPC が `confirmed` + `expires_at NULL`
2. Service → `insertPendingPaymentForReservation`
3. 管理画面 → `payments.service.markCashPaymentReceived`

---

## 型の使い分け

| 型 | 用途 | ファイル |
|----|------|----------|
| `domain.ts` | UI / Service / Auth | `ReservationStatus`, `UserProfile` 等 |
| `database.ts` | Repository のみ | `Database`, `Row` 型, RPC 型 |
| `api.ts` | HTTP DTO | `SlotDTO`, `PlanDTO` |

---

## 権限モデル（二重防御）

1. **RLS** — `auth.uid()`, `is_admin()`, `can_manage_business()` 等（PostgreSQL）
2. **アプリ層** — `management-access.ts`, middleware

移行時は RLS を外してもアプリ層で最低限の防御が効くよう、**書き込みは service_role / server のみ**を維持する。

RLS 期待値テスト: `src/lib/auth/rls-expectations.test.ts`

---

## ディレクトリ責務

| パス | 責務 |
|------|------|
| `src/app/` | ルーティング・ページ・Route Handler |
| `src/actions/` | Server Actions（Service 呼び出し） |
| `src/components/` | プレゼンテーション（domain 型） |
| `src/lib/services/` | ユースケース |
| `src/lib/repositories/` | 永続化（Supabase 実装） |
| `src/lib/auth/` | 認証・認可ヘルパ |
| `src/lib/supabase/` | Supabase クライアント生成（インフラ） |
| `src/types/domain.ts` | DB 非依存ドメイン型 |
| `src/types/database.ts` | Supabase スキーマ型 |
| `supabase/migrations/` | PostgreSQL DDL / RPC / RLS |

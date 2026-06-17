# DB 移行設計 — 現状調査と Supabase 依存低減案

将来 Supabase から AWS RDS / さくらクラウド PostgreSQL / 別 DB へ移行する可能性を踏まえた調査結果と設計案です。

**本ドキュメントは設計のみ。大規模リファクタリング・DB 変更は実施していません。**

関連: [architecture.md](./architecture.md) | [db-schema.md](./db-schema.md)

---

## 1. エグゼクティブサマリー

| 観点 | 現状 | 移行難易度 |
|------|------|------------|
| 予約 CRUD | RPC + Repository 経由 | 中（RPC → アプリ transaction 化が必要） |
| 認証 | Supabase Auth 深依存 | **高**（Auth0 / Cognito / 自前 JWT 等への置換） |
| RLS | 全テーブルで有効 | 中（アプリ層権限チェックで代替可能だが要テスト） |
| pg_cron | DB 内のみ | **低**（Vercel Cron 等に移しやすい） |
| Stripe Webhook | ~~Route 内で admin client 直叩き~~ → Repository 経由 | 低 |
| 型 | database.ts が UI まで漏れ | 低（domain.ts 分離開始済み） |

**結論:** PostgreSQL 本体の移行は可能だが、**Supabase Auth + RLS + PostgREST スタイル API** が最大の障壁。段階的に Repository / Auth Adapter 化を進めるのが現実的。

---

## 2. Supabase 依存箇所一覧

### 2.1 クライアント生成（インフラ層）

| ファイル | 役割 |
|----------|------|
| `src/lib/supabase/server.ts` | SSR 用 anon client |
| `src/lib/supabase/admin.ts` | service_role client |
| `src/lib/supabase/client.ts` | ブラウザ client（**現在未使用**） |
| `src/middleware.ts` | `@supabase/ssr` 直使用 |

### 2.2 `.from()` / `.rpc()` — Repository 内（移行の正規出口）

| ファイル | 操作 |
|----------|------|
| `reservations.repository.ts` | `create_reservation_atomic`, `cancel_reservation_atomic`, CRUD |
| `payments.repository.ts` | payments SELECT/UPDATE |
| `plans.repository.ts` | plans SELECT |
| `slots.repository.ts` | availability_slots SELECT（admin も使用） |

### 2.3 `.from()` — Repository 外（**移行時に集約すべき**）

| ファイル | テーブル | 優先度 |
|----------|----------|--------|
| `get-admin-reservations.ts` | reservations, fishing_spots | **高** |
| `get-my-reservations.ts` | reservations | **高** |
| `get-reservation.ts` | reservations | **高** |
| `management-access.ts` | business_admin_assignments, fishing_spots, reservations, businesses | **高** |
| `admin-notification-recipients.ts` | business_admin_assignments, profiles | 中 |
| `get-spots.ts`, `get-spot-by-id.ts`, `get-spot-by-slug.ts` | fishing_spots | 中 |
| `get-plans.ts`, `get-plan-by-slug.ts` | plans | 中 |
| `api/checkout/route.ts` | reservations UPDATE | **高** |
| `api/webhooks/stripe/route.ts` | reservations, payments | **高** |
| `reserve/complete/page.tsx` | reservations SELECT | 中 |
| `(public)/blog/*.tsx`, `api/blog/*` | blog_posts | 低 |
| `(public)/catches/*.tsx`, `api/catches/*` | catch_reports | 低 |
| `(admin)/admin/blog/actions.ts` | blog_posts INSERT | 低 |
| `(admin)/admin/catches/actions.ts` | catch_reports INSERT | 低 |
| `api/spots/*`, `api/plans/*`, `api/reservations/*` | 各種 | 中 |
| `get-user.ts`, `fetch-profile-role.ts` | profiles | **高** |
| `admin/login/actions.ts` | profiles | 中 |
| `api/admin/set-role/route.ts` | profiles UPDATE | 低（dev only） |

### 2.4 `.rpc()` 一覧

| RPC | 呼び出し元 | 代替方針 |
|-----|------------|----------|
| `create_reservation_atomic` | `reservations.repository.ts` | アプリ側 transaction + `SELECT FOR UPDATE` |
| `cancel_reservation_atomic` | `reservations.repository.ts` | 同上 |
| `expire_pending_reservations` | **pg_cron のみ**（アプリ未使用） | Cron Job → HTTP endpoint → Service |

### 2.5 `supabase.auth` 依存

| ファイル | 操作 |
|----------|------|
| `middleware.ts` | `getUser()` |
| `get-user.ts` | `getUser()`, profile 取得 |
| `(auth)/actions.ts` | `signInWithOtp`, `signOut` |
| `auth/callback/route.ts` | `exchangeCodeForSession`, `signOut` |
| `admin/login/actions.ts` | `signInWithPassword`, `signOut` |
| `api/admin/set-password/route.ts` | `auth.admin.updateUserById` |

### 2.6 service_role 使用箇所

| ファイル | 理由 |
|----------|------|
| `reservations.repository.ts` | RPC, payments INSERT, admin 読取 |
| `payments.repository.ts` | payments 書き込み（RLS バイパス） |
| `slots.repository.ts` | 定員集計（RLS バイパス） |
| `api/checkout/route.ts` | stripe_checkout_session_id 更新 |
| `api/webhooks/stripe/route.ts` | confirmed + payments |
| `admin-notification-recipients.ts` | profiles / assignments 読取 |
| `reserve/complete/page.tsx` | 決済完了表示 |
| `api/admin/set-role`, `set-password` | 開発用 |
| `(admin)/blog`, `catches/actions.ts` | コンテンツ INSERT |

**移行後:** service_role 相当は DB 接続プールの「アプリ DB ユーザー」（RLS 無効 or BYPASSRLS）に置換。

### 2.7 RLS / `auth.uid()` 依存（DB 側）

| 関数 / 概念 | migration |
|-------------|-----------|
| `is_admin()`, `is_business_admin()`, `is_management()` | 002, 006, 007 |
| `can_manage_business()`, `can_manage_spot()` | 006, 007 |
| `auth.uid()` ベース policies | 002, 006, 007 |
| profile role 変更トリガー | 007b |

**アプリ側ミラー:** `management-access.ts`, `middleware.ts`, `rls-expectations.test.ts`

移行時オプション:
- **A:** 新 DB でも RLS を維持（PostgreSQL 標準機能）+ 別 Auth の JWT claim 連携
- **B:** RLS を外し、アプリ層 + DB ユーザー権限で防御（要監査）

### 2.8 pg_cron 依存

| 項目 | 内容 |
|------|------|
| ジョブ名 | `expire-pending-reservations` |
| 間隔 | `*/5 * * * *` |
| 実行内容 | `SELECT expire_pending_reservations()` |
| アプリコード | **呼び出しなし** |

→ Cron 基盤の差し替えが最も容易。RPC 本体は HTTP 経由でも DB 直叩きでも可。

### 2.9 `database.ts` 型の漏れ

| 層 | 使用ファイル数（概算） | 例 |
|----|------------------------|-----|
| UI components | 6 | `ReservationStatusBadge`, `ReserveForm` |
| lib (非 repository) | 15+ | `payment-method.ts`, `management-access.ts` |
| Service | 3 | `reservations.service` は Repository 型のみ |
| Repository | 4 | Row 型（**ここに留めるべき**） |

**対策:** `src/types/domain.ts` を新設。UI / Service は domain 型へ段階移行。

---

## 3. 直接 Supabase を使っているファイル一覧（42 ファイル）

### src/app

```
middleware.ts
(auth)/actions.ts
auth/callback/route.ts
admin/login/actions.ts
reserve/complete/page.tsx
(public)/blog/page.tsx, blog/[slug]/page.tsx
(public)/catches/page.tsx, catches/[id]/page.tsx
(admin)/admin/blog/actions.ts
(admin)/admin/catches/actions.ts, catches/new/page.tsx
api/checkout/route.ts
api/webhooks/stripe/route.ts
api/admin/set-role/route.ts, set-password/route.ts
api/blog/route.ts, blog/[slug]/route.ts
api/catches/route.ts, catches/[id]/route.ts
api/spots/route.ts, spots/[slug]/route.ts
api/plans/route.ts
api/reservations/[id]/route.ts
```

### src/lib（Repository 除く）

```
supabase/server.ts, admin.ts, client.ts
auth/get-user.ts, fetch-profile-role.ts, management-access.ts
reservations/get-admin-reservations.ts, get-my-reservations.ts, get-reservation.ts
spots/get-spots.ts, get-spot-by-id.ts, get-spot-by-slug.ts
plans/get-plans.ts, get-plan-by-slug.ts
email/admin-notification-recipients.ts
repositories/*.ts（4 ファイル — 正規出口）
slots/affected-slots.ts（deprecated 関数のみ SupabaseClient 型）
```

### src/actions

```
reservation.ts — Supabase 直接なし（Service 経由 ✅）
```

### src/components

```
直接 Supabase なし ✅
```

---

## 4. 移行時の障壁（高 → 低）

### 🔴 高

1. **Supabase Auth** — セッション Cookie、OTP、admin パスワードログインすべて Supabase 固有
2. **`create_reservation_atomic` RPC** — FOR UPDATE + 容量検証 + 複数 slot 更新の transaction。アプリ側再実装に工数
3. **RLS + auth.uid()** — 別 Auth では JWT を PostgreSQL に渡す仕組み（`request.jwt.claims` 等）が必要

### 🟡 中

4. **PostgREST クエリ構文** — `.select('*, plans(*)')` 等の JOIN 表現 → SQL / ORM 書き換え
5. **service_role パターン** — 接続ユーザー設計の見直し
6. **profiles と auth.users の同期** — Supabase トリガー依存の可能性

### 🟢 低

7. **pg_cron** — 外部 Cron + HTTP/RPC で代替容易
8. **blog/catches** — 単純 CRUD
9. **型の分離** — domain.ts で対応開始済み

---

## 5. 推奨アーキテクチャ（移行後イメージ）

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  UI / Action │────▶│  Service        │────▶│  Repository      │
│  domain 型   │     │  interface 依存 │     │  interface       │
└──────────────┘     └────────┬────────┘     └────────┬─────────┘
                              │                       │
                     ┌────────▼────────┐     ┌──────────▼───────────┐
                     │  AuthProvider   │     │  SupabaseRepo (現)   │
                     │  interface      │     │  PgRepo (将来)       │
                     └────────┬────────┘     └──────────┬───────────┘
                              │                       │
                     ┌────────▼────────┐     ┌──────────▼───────────┐
                     │ SupabaseAuth    │     │  PostgreSQL          │
                     │ CognitoAuth…    │     │  (+ optional RLS)    │
                     └─────────────────┘     └──────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  Cron: Vercel Cron / EventBridge → POST /api/cron/expire-pending │
│        → ExpirePendingService → Repository                       │
└──────────────────────────────────────────────────────────────────┘
```

### Repository interface 例（将来）

```typescript
// lib/repositories/reservations.repository.interface.ts
export interface ReservationsRepository {
  createAtomic(input: CreateReservationInput): Promise<AtomicResult>;
  cancelAtomic(input: CancelReservationInput): Promise<AtomicResult>;
  findByIdForUser(id: string, userId: string): Promise<ReservationSummary | null>;
  confirmFromStripe(input: ConfirmStripeInput): Promise<void>;
}
```

Supabase 実装と node-postgres / Drizzle 実装を差し替え可能に。

### Auth Provider 例（将来）

```typescript
export interface AuthProvider {
  getSession(): Promise<{ user: AuthUser } | null>;
  signInWithEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
}
```

---

## 6. 設計案詳細

### 6.1 Repository 層に Supabase 依存を閉じ込める

**現状:** 約 20 ファイルが Repository 外で `.from()` を実行。

**案:**
1. `profiles.repository.ts`, `businesses.repository.ts`, `content.repository.ts` を新設
2. `get-*` 系を Repository メソッドに移動（ファイル名は維持し中身を delegate でも可）
3. Stripe webhook / checkout の DB 操作を `reservations.repository` / `payments.repository` に集約

**影響範囲:** TypeScript のみ。DB / RLS 変更なし。

### 6.2 Service 層を DB 非依存に近づける

**現状:** `reservations.service.ts` は既に Repository 経由で良好。

**案:**
1. Service の戻り値を `domain.ts` 型に統一
2. `mapRpcErrorToHttpStatus` 等は Service に残す（DB エラーコード文字列は Repository が domain エラーに変換）
3. Route Handler は Service のみ呼ぶ

### 6.3 Auth Provider を差し替えやすくする

**案:**
1. `lib/auth/provider.ts` に `AuthProvider` interface
2. `SupabaseAuthProvider` が `get-user.ts` の実装を担当
3. `middleware.ts` は provider 経由で session 確認
4. `User`（@supabase/supabase-js）→ `AuthUser`（domain）に変換

**リスク:** Cookie 形式が Supabase 固有。全面移行時はセッションストア（Redis 等）も検討。

### 6.4 RLS に頼りすぎずアプリ側権限チェックを強化

**現状:** 二重防御済み（`management-access.ts` + RLS）。

**案:**
1. 書き込みは引き続き server / service_role のみ
2. 読み取りも admin 系は Repository 内で `canManage*` チェック後に service_role クエリ
3. RLS 期待値を `docs/rls-policy-map.md` に文書化（007 の policy 一覧）
4. 移行時 B 案（RLS 無効）でも admin 操作が漏れないよう E2E テスト追加

### 6.5 RPC を transaction 実装に置き換えやすくする

**案:**
1. Repository の `createReservationAtomic` の **入出力型**を Supabase RPC 型から独立（既に `CreateReservationAtomicInput` あり ✅）
2. 将来 `PgTransactionReservationsRepository` で:
   - `BEGIN`
   - affected slots `FOR UPDATE`
   - 容量検証
   - reservations INSERT
   - slots UPDATE booked_count
   - `COMMIT`
3. RPC の error_code 文字列を domain `ReservationErrorCode` enum にマップ

**リスク:** 同時実行テスト（負荷テスト）が必須。RPC と同等のロック順序を維持すること。

### 6.6 pg_cron → 外部 Cron

**案:**
1. `POST /api/cron/expire-pending` を新設（`CRON_SECRET` で保護）
2. 内部で `expirePendingReservations()` Service → Repository
3. Repository は当面 `admin.rpc('expire_pending_reservations')`、将来は SQL 直実行
4. Vercel Cron `vercel.json` または AWS EventBridge → Lambda

**メリット:** アプリコードから失効ロジックを呼べるようになり、DB 移行後も Cron 基盤だけ差し替え可能。

**注意:** 実装時は DB / RPC 変更を伴う可能性 → **別タスクで設計レビュー必須**。

### 6.7 domain 型と database 型の分離

**実施済み（安全）:**
- `src/types/domain.ts` — enum / 概要型
- `database.ts` — domain から re-export（後方互換）

**今後:**
- UI components の import を `@/types/domain` に変更
- Repository 境界で `toReservationSummary(row)` mapper 関数

---

## 7. 優先順位とロードマップ

| 順位 | タスク | 工数 | リスク | 状態 |
|------|--------|------|--------|------|
| 1 | `.from` / `.rpc` を Repository に集約 | M | 低 | 未着手 |
| 2 | `supabase.auth` を Auth Provider に集約 | M | 中 | 未着手 |
| 3 | UI/Service から database 型を domain に移行 | S | 低 | **着手** |
| 4 | Stripe webhook/checkout の Repository 化 | S | 低 | 未着手 |
| 5 | RLS 依存ポイントのドキュメント化 | S | なし | **本 doc + rls-expectations.test** |
| 6 | Cron HTTP 化の設計 | S | 中 | 案のみ |
| 7 | RPC → アプリ transaction 化 | L | **高** | 移行時 |
| 8 | Auth 全面置換 | XL | **高** | 移行時 |

---

## 8. すぐ直すべき vs 後回し

### すぐ直すべき（次の PR で安全に可能）

1. **Stripe webhook / checkout** の DB 操作を Repository へ（挙動不変）
2. **get-reservation / get-my-reservations / get-admin-reservations** を Repository へ
3. **UI コンポーネント**の import を `domain.ts` へ
4. **management-access.ts** の DB クエリを `profiles.repository` / `businesses.repository` へ

### 後回しでよい

1. blog / catches の Repository 化（本番予約フローと無関係）
2. `lib/supabase/client.ts` 削除（未使用）
3. deprecated `incrementAffectedSlots` / `decrementAffectedSlots` 削除
4. RPC のアプリ transaction 化（DB 移行決定後）
5. Auth Provider 抽象化（Auth 移行決定後）

---

## 9. リスク

| リスク | 説明 | 緩和 |
|--------|------|------|
| Repository 移行中の regression | クエリ条件の差異 | 既存テスト + 手動 E2E |
| Auth 移行時のセッション断絶 | 全ユーザーログアウト | メンテナンスウィンドウ |
| RPC 置換時のダブルブッキング | ロック順序不一致 | 同時予約の integration test |
| RLS 無効化時の権限漏れ | admin データ露出 | アプリ層チェック + penetration test |
| Cron 二重実行 | 失効処理の競合 | idempotent 設計（現 RPC は概ね idempotent） |

---

## 10. 実装しない危険項目（要承認）

以下は本調査では **実装していません**。

- DB 構造変更 / migration 変更
- RLS ポリシー変更
- RPC 削除または SQL ロジック変更
- 認証方式変更（Supabase Auth 廃止）
- service_role キー運用変更
- pg_cron 停止 / Cron HTTP 化の本番適用
- 大規模ディレクトリ再編

---

## 11. 今回の safe 実装

| ファイル | 内容 |
|----------|------|
| `docs/architecture.md` | レイヤ責務・現状ギャップ |
| `docs/db-migration-design.md` | 本ドキュメント |
| `src/types/domain.ts` | DB 非依存ドメイン型 |
| `src/types/domain.test.ts` | ドメイン型の許容値テスト |
| `src/types/database.ts` | domain 型を re-export（後方互換） |

---

## 12. 進捗（Repository 集約 Phase 1 — 2025-06）

### 完了

| 項目 | 移行先 |
|------|--------|
| `get-reservation.ts` | `findReservationDetailByIdForUser` |
| `get-my-reservations.ts` | `findMyReservationsByUserId` |
| `get-admin-reservations.ts` | `findAdminReservationsPaginated` 他 6 関数 |
| `management-access.ts` DB クエリ | `businesses.repository.ts` |
| `api/checkout` session_id 更新 | `updateReservationStripeCheckoutSessionId` |
| `api/webhooks/stripe` DB 操作 | `reservations.repository` + `payments.repository` |

### 新規 Repository

- `businesses.repository.ts` — assignments, business names, spot/reservation lookup, manageable spots

### 残タスク（Phase 2）

- ~~`get-user.ts` / `fetch-profile-role.ts` → `profiles.repository.ts`~~ ✅
- ~~spots/plans getters → 既存 repository へ~~ ✅
- ~~`reserve/complete/page.tsx` admin client~~ ✅
- ~~admin-notification-recipients.ts~~ ✅
- blog/catches ページ・API（一覧・詳細）
- Auth Provider 抽象化
- middleware.ts の Supabase client 生成（要設計）

---

## 13. 進捗（Repository 集約 Phase 2 — 2025-06）

### 完了

| 項目 | 移行先 |
|------|--------|
| `get-user.ts` profile 取得 | `profiles.repository.ts`（`getUser()` は Auth のまま） |
| `fetch-profile-role.ts` | `findProfileRoleByUserIdWithClient` |
| `get-spots` / `get-spot-by-id` / `get-spot-by-slug` | `fishing-spots.repository.ts` |
| `get-plans` / `get-plan-by-slug` | `plans.repository.ts`（既存関数へ delegate） |
| `reserve/complete/page.tsx` | `findReservationCompleteDisplayByIdAdmin` |
| `admin-notification-recipients.ts` | `findBusinessAdminEmailsByBusinessId` |
| メール `findProfileEmailByUserId` | `profiles.repository.ts` |
| `api/spots` / `api/plans` / `api/spots/[slug]` | fishing-spots / plans repository |
| `admin/catches/new` 釣り場選択 | `findActiveSpotIdAndNames` |

### 新規 Repository

- `profiles.repository.ts` — profile 読取、通知先メール（service_role）
- `fishing-spots.repository.ts` — 釣り場 CRUD 読取

### 実装せず案のみ（Auth リスク）

| 項目 | 理由 |
|------|------|
| `middleware.ts` | Cookie 付き Supabase client を自前生成。Repository 化は client 注入設計が必要 |
| `admin/login/actions.ts` | signInWithPassword 直後の profile 確認。Auth と一体 |
| `(auth)/actions.ts` | signInWithOtp / signOut |
| `auth/callback/route.ts` | exchangeCodeForSession |
| `supabase.auth.getUser()` 抽象化 | Auth Provider 設計後に Phase 3 |

### 残タスク（Phase 3）

- ~~blog/catches ページ・API（一覧・詳細）~~ ✅
- Auth Provider 抽象化（設計のみ → セクション 15）
- middleware.ts の Supabase client 生成（要設計）
- ~~`api/reservations/[id]`~~ ✅（Phase 4）

---

## 14. 進捗（Repository 集約 Phase 3 — 2025-06）

### 完了

| 項目 | 移行先 |
|------|--------|
| `(public)/blog/*` | `blog.repository.ts` |
| `(public)/catches/*` | `catch-reports.repository.ts` |
| `api/blog/*` | `blog.repository.ts` |
| `api/catches/*` | `catch-reports.repository.ts` |
| `admin/blog/actions.ts` | `insertBlogPostAdmin` |
| `admin/catches/actions.ts` | `insertCatchReportAdmin` |

### 新規 Repository

- `blog.repository.ts` — 公開読取 + 管理 INSERT（service_role）
- `catch-reports.repository.ts` — 同上

### 実装せず（Storage / 権限拡大リスク）

| 項目 | 理由 |
|------|------|
| `cover_image_url` / `image_url` アップロード | Supabase Storage bucket / policy 変更が必要 |
| 釣果画像の新規アップロード UI | 現行は image_url 未設定のまま INSERT のみ |

---

## 15. Auth Provider 抽象化 — 設計案（未実装）

### 現状の `supabase.auth` 使用箇所

| ファイル | 操作 |
|----------|------|
| `middleware.ts` | `getUser()` — Cookie セッション |
| `get-user.ts` | `getUser()` |
| `(auth)/actions.ts` | `signInWithOtp`, `signOut` |
| `auth/callback/route.ts` | `exchangeCodeForSession`, `signOut` |
| `admin/login/actions.ts` | `signInWithPassword`, `signOut` |
| `api/admin/set-password/route.ts` | `auth.admin.updateUserById` |

### 推奨 interface（将来）

```typescript
// lib/auth/provider.ts
export type AuthUser = { id: string; email: string | null };

export interface AuthProvider {
  getSessionUser(): Promise<AuthUser | null>;
  signInWithEmailOtp(email: string, redirectTo: string): Promise<{ error?: string }>;
  signInWithPassword(email: string, password: string): Promise<{ user: AuthUser | null; error?: string }>;
  signOut(): Promise<void>;
  exchangeCodeForSession(code: string): Promise<{ ok: boolean; error?: string }>;
}
```

- `SupabaseAuthProvider` — 現行 `@supabase/ssr` + `createClient()` を内部に閉じ込める
- middleware 専用: `getSessionUserFromRequest(request)` — Cookie コンテキストが Server Component と異なるため **別メソッド**

### 差し替え境界

| 層 | 責務 |
|----|------|
| AuthProvider | セッション・OTP・パスワード・callback |
| profiles.repository | profile 読取（Phase 2 済み） |
| middleware | AuthProvider の request-scoped メソッドのみ呼ぶ |
| get-user.ts | AuthProvider + profiles.repository を組み合わせ |

### 段階的移行手順（提案）

1. **Phase A** — `SupabaseAuthProvider` を新設し、`get-user.ts` の `getUser()` のみ delegate（profile は現状維持）
2. **Phase B** — `(auth)/actions.ts` / `auth/callback` を Provider 経由に（ステージングで E2E）
3. **Phase C** — `admin/login/actions.ts` を Provider 経由に
4. **Phase D** — middleware を `AuthProvider.getSessionUserFromRequest` に（最もリスク高）
5. **Phase E** — Cognito / Auth.js 等の第二実装を追加し env で切替

### リスク

| リスク | 緩和 |
|--------|------|
| Cookie / セッション形式が Supabase 固有 | middleware は最後に移行。ロールバック用に Supabase 実装を残す |
| OTP メール送信方式変更 | Resend 連携は Supabase Auth 設定依存。Provider 差し替え時はメールテンプレ移行が必要 |
| 全ユーザーログアウト | メンテナンスウィンドウ + 事前告知 |
| admin パスワードログイン | business_admin / admin 専用フロー。一般 OTP と分離してテスト |

### 今回実装しない理由

ログイン不能は本番致命傷のため、Repository 集約（Phase 1〜3）完了後、ステージング E2E とロールバック手順が整ってから Phase A から着手する。

---

## 16. 進捗（Repository 集約 Phase 4 — 2025-06）

### 完了

| 項目 | 移行先 |
|------|--------|
| `GET /api/reservations/[id]` | 既存 `findReservationByIdForUser` を再利用 |

### 実装内容

- Route 内の `createClient().from("reservations")` を削除
- 認証は従来どおり `getUser()`（Auth 未変更）
- 404 / 401 / レスポンス `{ reservation }` 形式を維持
- `.single()` → `maybeSingle()` + null チェック（未存在時の挙動は同等）

### Repository 外に残る Supabase 依存（アプリ層）

| カテゴリ | ファイル |
|----------|----------|
| Auth | `middleware.ts`, `get-user.ts`（auth のみ）, `(auth)/actions.ts`, `auth/callback`, `admin/login/actions.ts` |
| Admin dev API | `api/admin/set-role`, `set-password` |
| deprecated | `affected-slots.ts` |
| インフラ | `lib/supabase/*` |

### 残タスク（Phase 5 以降）

- Auth Provider Phase A（`get-user.ts` のみ）
- `admin/login` の profile 取得 → `profiles.repository`（Auth フロー一体のため要 E2E）
- middleware Repository / Provider 化
- deprecated `incrementAffectedSlots` / `decrementAffectedSlots` 削除

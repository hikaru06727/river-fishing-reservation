# 川釣り予約サービス

1時間・3時間プランの川釣り予約サービス。

## 技術スタック

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (Auth / PostgreSQL / RLS)
- **Stripe** (オンライン決済 / Checkout)
- **Resend** (メール通知)

## クイックスタート

### 1. 依存関係

```bash
npm install
```

### 2. 環境変数

```bash
cp .env.example .env.local
```

[docs/env-vars.md](./docs/env-vars.md) を参照して `.env.local` を編集。

### 3. Supabase

migration 001〜008 を適用し、seed を投入します。

```bash
# CLI 推奨
supabase db push
```

手動適用: [docs/supabase-setup.md](./docs/supabase-setup.md) / [supabase/manual/sql-editor/README.md](./supabase/manual/sql-editor/README.md)

### 4. Stripe（ローカル）

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

表示された `whsec_...` を `STRIPE_WEBHOOK_SECRET` に設定。

詳細: [docs/stripe-setup.md](./docs/stripe-setup.md)

### 5. 開発サーバー

```bash
npm run dev
```

http://localhost:3000

### 6. 管理者ロール（初回）

Supabase SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE id = '<your-user-uuid>';
```

## 本番公開前

**必読:** [docs/production-checklist.md](./docs/production-checklist.md)

- 環境変数チェック
- Supabase migration 008 まで適用
- Stripe Webhook 本番設定
- pg_cron（pending 自動失効）
- 手動 E2E 確認

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [docs/production-checklist.md](./docs/production-checklist.md) | 本番公開前チェックリスト |
| [docs/env-vars.md](./docs/env-vars.md) | 環境変数一覧 |
| [docs/supabase-setup.md](./docs/supabase-setup.md) | Supabase 適用手順 |
| [docs/stripe-setup.md](./docs/stripe-setup.md) | Stripe 設定手順 |
| [docs/admin-operations.md](./docs/admin-operations.md) | 管理者向け運用 |
| [docs/architecture.md](./docs/architecture.md) | アーキテクチャ・レイヤ責務 |
| [docs/db-migration-design.md](./docs/db-migration-design.md) | DB 移行・依存低減設計 |
| [docs/db-schema.md](./docs/db-schema.md) | DB スキーマ |

## 予約フロー概要

| 支払い方法 | 作成時 status | Stripe | 失効 |
|------------|---------------|--------|------|
| online | pending（30分） | Checkout 必須 | cron で expired |
| cash_at_venue | confirmed | 不可 | なし |

## スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクションサーバー |
| `npm run typecheck` | TypeScript 型チェック |
| `npm test` | ユニットテスト (Vitest) |
| `npm run lint` | ESLint |
| `npm run test:e2e` | E2E テスト (Playwright) |

## ディレクトリ構成

```
src/
├── app/           # App Router ページ・API
├── components/    # UI コンポーネント
├── lib/           # Supabase, Auth, Stripe, Email
├── actions/       # Server Actions
├── types/         # 型定義
└── hooks/         # カスタムフック
supabase/
├── migrations/    # 001〜008
└── manual/        # SQL Editor 手動適用用
docs/              # 運用・セットアップドキュメント
```

# 川釣り予約サービス

1時間・3時間プランの川釣り予約サービス MVP。

## 技術スタック

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (Auth / PostgreSQL / Storage)
- **Stripe** (Phase 2)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数

`.env.example` をコピーして `.env.local` を作成:

```bash
cp .env.example .env.local
```

Supabase ダッシュボードから以下を設定:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. データベース

Supabase SQL Editor で以下を順に実行:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/seed.sql`

### 4. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 で確認

## ディレクトリ構成

```
src/
├── app/           # App Router ページ・API
├── components/    # UI コンポーネント
├── lib/           # Supabase, Auth, Utils
├── actions/       # Server Actions
├── types/         # 型定義
└── hooks/         # カスタムフック
```

## スクリプト

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクションサーバー |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 型チェック |

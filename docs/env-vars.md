# 環境変数一覧

`.env.example` を `.env.local`（ローカル）またはホスティングの Secret（本番）にコピーして設定します。

## 必須

| 変数 | 公開 | 用途 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | はい | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | はい | Supabase 匿名キー（RLS 下で動作） |
| `SUPABASE_SERVICE_ROLE_KEY` | **いいえ** | サーバー専用。RLS バイパス（予約 RPC、Webhook、payments） |
| `STRIPE_SECRET_KEY` | **いいえ** | Stripe Checkout Session 作成・Webhook 検証 |
| `STRIPE_WEBHOOK_SECRET` | **いいえ** | `checkout.session.completed` の署名検証 |
| `NEXT_PUBLIC_APP_URL` | はい | アプリのベース URL（Checkout リダイレクト、Auth メール） |

## メール（Resend）

トランザクションメール（予約・決済・キャンセル通知）専用。**Supabase Auth の OTP は別設定。**

詳細・確認手順・トラブルシュート: [email-setup.md](./email-setup.md)

| 変数 | 公開 | 用途 |
|------|------|------|
| `EMAILS_ENABLED` | いいえ | `true` / `1` で送信有効。`false`（デフォルト）なら skip（予約処理は継続） |
| `RESEND_API_KEY` | **いいえ** | Resend API キー（`re_...`） |
| `MAIL_FROM` | いいえ | 送信元。例: `予約 <noreply@yourdomain.com>`。開発は `onboarding@resend.dev` 可 |
| `ADMIN_NOTIFICATION_EMAIL` | いいえ | 担当事業に business_admin がいない場合の admin 通知フォールバック |

**送信確認（ローカル）:** `ADMIN_SECRET` 設定後、`POST /api/dev/send-test-email`（`x-admin-secret` ヘッダ必須）。レスポンスの `skipReason` / `hint` / `config` で設定不足を判定。

## 開発専用

| 変数 | 用途 |
|------|------|
| `ADMIN_SECRET` | `/api/admin/set-role`, `set-password`, `/api/dev/send-test-email` の保護。**本番では未設定推奨**（production では API 自体が 403） |

## 未使用 / 任意

| 変数 | 備考 |
|------|------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 現行実装では未参照。将来 Elements 等を使う場合用 |
| `PLAYWRIGHT_BASE_URL` | E2E テスト用（デフォルト `http://localhost:3000`） |
| `CI` | CI 環境で Playwright が自動設定 |

## 本番設定例（Vercel）

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # Encrypted
STRIPE_SECRET_KEY=sk_live_...           # Encrypted
STRIPE_WEBHOOK_SECRET=whsec_...         # Encrypted
NEXT_PUBLIC_APP_URL=https://your-domain.com
EMAILS_ENABLED=true
RESEND_API_KEY=re_...                   # Encrypted
MAIL_FROM=予約 <noreply@yourdomain.com>
ADMIN_NOTIFICATION_EMAIL=ops@yourdomain.com
```

## コード上の参照箇所

- Supabase クライアント: `src/lib/supabase/{client,server,admin}.ts`, `src/middleware.ts`
- Stripe: `src/lib/stripe/server.ts`, `src/app/api/checkout`, `src/app/api/webhooks/stripe`
- メール: `src/lib/email/config.ts`, `src/lib/email/send-email.ts` — 詳細 [email-setup.md](./email-setup.md)
- App URL: `src/app/api/checkout/route.ts`, `src/app/(auth)/actions.ts`

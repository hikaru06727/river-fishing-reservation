# メール送信（Resend）

予約・決済・キャンセル通知は **Resend** 経由で送信します。  
Resend SDK への依存は `src/lib/email/client.ts` と `src/lib/email/send-email.ts` に閉じ込め、ドメインコードは `sendEmail()` のみを呼びます。

Supabase Auth の OTP / マジックリンクは **Supabase 側の設定**（本ドキュメントの対象外）。

---

## 1. 必要な環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `EMAILS_ENABLED` | 送信する場合 | `true` または `1`。それ以外は全 skip |
| `RESEND_API_KEY` | 送信する場合 | Resend ダッシュボード → API Keys |
| `MAIL_FROM` | 送信する場合 | 送信元。例: `予約 <noreply@yourdomain.com>` |
| `ADMIN_NOTIFICATION_EMAIL` | 任意 | 担当事業に business_admin がいない場合の admin 通知先 |

詳細は [env-vars.md](./env-vars.md) を参照。

### ローカル最小例（Resend 共有ドメイン）

```env
EMAILS_ENABLED=true
RESEND_API_KEY=re_xxxxxxxx
MAIL_FROM=River Fishing <onboarding@resend.dev>
ADMIN_NOTIFICATION_EMAIL=you@example.com
```

本番では Resend で **自ドメインの DNS（SPF/DKIM）検証** 後、`MAIL_FROM` を自ドメインに変更してください。

---

## 2. アーキテクチャ（Resend 依存の所在）

```
予約 / キャンセル / Webhook
        │
        ▼
  *-emails.ts（テンプレート・宛先解決）
        │  sendEmail() のみ
        ▼
  send-email.ts ──► client.ts ──► resend パッケージ
        ▲
  config.ts（EMAILS_ENABLED / RESEND_API_KEY / MAIL_FROM）
```

### Resend を直接 import するファイル

| ファイル | 役割 |
|----------|------|
| `src/lib/email/client.ts` | Resend SDK シングルトン |
| `src/lib/email/send-email.ts` | `client.emails.send()` 呼び出し |

### `sendEmail()` を呼ぶファイル（Resend 非依存）

| ファイル | タイミング | 呼び出し元 |
|----------|------------|------------|
| `reservation-emails.ts` | 予約作成 | `reservations.service.ts` |
| `payment-confirmation-emails.ts` | オンライン決済完了 | `api/webhooks/stripe/route.ts` |
| `reservation-cancellation-emails.ts` | キャンセル | `reservations.service.ts` |
| `api/dev/send-test-email/route.ts` | 開発テスト | 手動 curl |

### 関連（送信しない）

| ファイル | 役割 |
|----------|------|
| `admin-notification-recipients.ts` | 管理者宛先解決（DB + `ADMIN_NOTIFICATION_EMAIL`） |
| `config.ts` | 環境変数・skip 判定 |

---

## 3. メール送信確認手順

### A. 開発テスト API（推奨）

1. `.env.local` に `ADMIN_SECRET` と Resend 設定を入れる
2. 開発サーバー起動: `npm run dev`（またはローカル `npm run start`）
3. 送信:

**注意:** 旧実装は `NODE_ENV=production`（ローカル `next start`）でも拒否していました。現在は **Vercel 上のみ無効**、ローカルでは `ADMIN_SECRET` があれば利用可能です。403 時はレスポンスの `debug` フィールド（`hasAdminSecret`, `nodeEnv`, `isVercel`）を確認してください。

```bash
curl -X POST http://localhost:3000/api/dev/send-test-email \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d "{\"to\":\"you@example.com\"}"
```

**成功例:**

```json
{
  "ok": true,
  "skipped": false,
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "to": "you@example.com",
  "config": { "enabled": true, "ready": true, "skipReason": null, ... }
}
```

**設定不足例:**

```json
{
  "ok": true,
  "skipped": true,
  "skipReason": "missing_api_key",
  "hint": "Set RESEND_API_KEY in .env.local ...",
  "config": { "enabled": true, "ready": false, ... }
}
```

### B. 予約フローで確認

1. Resend 設定を有効化
2. 予約を 1 件作成（online または cash）
3. サーバーログで `[sendReservationCreatedEmails]` を確認
4. Resend ダッシュボード → Emails で配信状況を確認

### C. ログの見方

| ログ | 意味 |
|------|------|
| `[sendEmail] Skipped (disabled) ...` | `EMAILS_ENABLED` が true ではない |
| `[sendEmail] Skipped (missing_api_key) ...` | `RESEND_API_KEY` 未設定 |
| `[sendEmail] Skipped (missing_from) ...` | `MAIL_FROM` 未設定 |
| `[sendEmail] Provider API error ...` | Resend API 拒否（ドメイン未検証など） |
| `[sendReservationCreatedEmails] customer email skipped ...` | 上記 skip がハンドラ経由で発生 |
| `[sendReservationCreatedEmails] no admin notification recipients` | 管理者宛先が解決できない |
| `[sendReservationCreatedEmails] customer email not found` | 予約者 profiles.email が空 |

---

## 4. 予約時メールが送られない場合の切り分け

| 順 | 確認項目 | 対処 |
|----|----------|------|
| 1 | `EMAILS_ENABLED=true` か | `.env.local` を修正し dev サーバー再起動 |
| 2 | `RESEND_API_KEY` / `MAIL_FROM` | テスト API の `config` / `skipReason` を確認 |
| 3 | ログに `Skipped` | `hint` メッセージに従って env 修正 |
| 4 | ログに `Provider API error` | Resend ダッシュボードでドメイン検証・送信制限を確認 |
| 5 | `customer email not found` | Supabase `profiles.email` を確認 |
| 6 | `no admin notification recipients` | 事業に business_admin を割当、または `ADMIN_NOTIFICATION_EMAIL` 設定 |
| 7 | 予約自体は成功 | **想定どおり** — メール失敗は throw せず skip。予約 DB は変更されない |
| 8 | Resend には届くが受信トレイにない | スパム、Resend の共有ドメイン制限、受信側フィルタを確認 |

**注意:** `EMAILS_ENABLED=false`（デフォルト）ではメールは意図的に送られません。予約・決済は正常に完了します。

---

## 5. 将来 Resend から移行する設計案（未実装）

現状でも境界は以下の通りで、大規模 refactor なしに Provider 差し替え可能です。

### 推奨 interface（将来）

```typescript
// lib/email/provider.ts（将来追加）
export type EmailSendInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
};

export type EmailSendResult =
  | { ok: true; skipped?: boolean; skipReason?: string; id?: string }
  | { ok: false; error: string };

export interface EmailProvider {
  send(input: EmailSendInput): Promise<EmailSendResult>;
}
```

### 実装配置案

| 実装 | ファイル | 備考 |
|------|----------|------|
| Resend | `providers/resend.provider.ts` | 現行 `client.ts` + send ロジックを移動 |
| Amazon SES | `providers/ses.provider.ts` | AWS SDK |
| SMTP | `providers/smtp.provider.ts` | nodemailer 等 |
| さくらメール | `providers/smtp.provider.ts` | SMTP 設定で共用可 |

### 差し替え手順（提案）

1. `sendEmail()` を `getEmailProvider().send()` の thin wrapper に変更
2. env `EMAIL_PROVIDER=resend|ses|smtp` で実装を選択
3. `*-emails.ts` / service / webhook は **変更不要**
4. Supabase Auth OTP は別系統（Supabase SMTP または Auth Provider 移行時に対応）

### 移行時の注意

- **認証メール**（OTP）は Resend トランザクションメールとは別経路
- テンプレート HTML は Provider 非依存のまま維持可能
- `MAIL_FROM` / ドメイン DNS は Provider ごとに再設定が必要

---

## 6. 送信タイミング一覧

| イベント | 関数 | 送信先 |
|----------|------|--------|
| 予約作成（online / cash） | `sendReservationCreatedEmails` | 予約者 + business_admin（なければ fallback） |
| Stripe 決済完了 | `sendPaymentConfirmedEmails` | 予約者 + business_admin |
| キャンセル | `sendReservationCancelledEmails` | 予約者 + business_admin |

いずれも失敗時 **throw しない**（予約・決済・Webhook は継続）。

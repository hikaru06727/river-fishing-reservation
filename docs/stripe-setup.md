# Stripe 設定手順

## 1. API キー

Stripe Dashboard → Developers → API keys

| 環境 | 変数 | キー形式 |
|------|------|----------|
| 開発 | `STRIPE_SECRET_KEY` | `sk_test_...` |
| 本番 | `STRIPE_SECRET_KEY` | `sk_live_...` |

現行実装は **Stripe Checkout（リダイレクト）** のため、クライアント側の Publishable Key は不要です。

## 2. Webhook

### 本番

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://<your-domain>/api/webhooks/stripe`
3. イベント: **`checkout.session.completed`**
4. Signing secret を `STRIPE_WEBHOOK_SECRET` に設定

### ローカル開発（Stripe CLI）

```bash
# Stripe CLI インストール後
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

表示される `whsec_...` を `.env.local` の `STRIPE_WEBHOOK_SECRET` に設定。

別ターミナルで:

```bash
npm run dev
```

## 3. Checkout フロー

```
ユーザー → POST /api/checkout { reservation_id }
         → Stripe Checkout Session 作成
         → success_url: /reserve/complete?session_id=...
         → cancel_url:  /reservation/confirm/{id}

Stripe → POST /api/webhooks/stripe (checkout.session.completed)
       → reservations: pending → confirmed（online のみ）
       → payments: upsert succeeded
       → 決済完了メール送信
```

## 4. ガード条件（実装済み）

### `/api/checkout`

- ログイン必須
- `payment_method === 'online'`
- `status === 'pending'`
- `expires_at` が未来

cash_at_venue は **422**「現金精算の予約はオンライン決済できません」

### Webhook

- 署名検証必須（`STRIPE_WEBHOOK_SECRET` 未設定時は **501**）
- `online` + `pending` のみ confirmed に更新
- cash / 既に confirmed / expired は skip（200 + `skipped: true`）

## 5. 本番確認チェック

- [ ] テストモードで end-to-end 決済成功
- [ ] Webhook ログに `confirmed: true` が記録される
- [ ] `NEXT_PUBLIC_APP_URL` が本番ドメイン（Checkout リダイレクト先）
- [ ] 本番切替後、live キー + live webhook secret に更新

## 6. トラブルシューティング

| 症状 | 確認項目 |
|------|----------|
| 決済後も pending | Webhook secret、エンドポイント URL、Stripe ログの delivery |
| localhost に飛ぶ | `NEXT_PUBLIC_APP_URL` |
| 422 決済期限切れ | pending 30 分経過 → 再予約 |
| 現金予約で Checkout 不可 | 正常動作 |

# アーキテクチャ

Next.js App Router + Supabase + Stripe 構成。

詳細は設計ドキュメントを参照。

## 主要フロー

1. ユーザーが空き枠を選択
2. 仮予約（pending）を作成
3. Stripe Checkout で決済
4. Webhook で予約確定（confirmed）

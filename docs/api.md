# API 設計

## 公開 API

| Method | Path | 説明 |
|---|---|---|
| GET | /api/spots | 釣り場一覧 |
| GET | /api/spots/[slug] | 釣り場詳細 |
| GET | /api/slots/with-plan | プラン別空き枠取得（`spot_id`, `plan_id`, `guest_count`, `date`） |

レスポンス DTO:

```json
{
  "plan": { "id", "name", "slug", "duration_minutes", "price_yen" },
  "guest_count": 1,
  "slots": [
    {
      "id": "uuid",
      "date": "2026-06-15",
      "start_time": "09:00",
      "end_time": "12:00",
      "remaining_count": 3,
      "affected_slot_ids": ["uuid", "..."]
    }
  ]
}
```

- `slots` 配列が唯一のデータソース（`slots_by_date` 等の重複構造なし）
- 日付別表示はクライアント側で `slots` を group すること

| GET | /api/plans | プラン一覧 |
| GET | /api/catches | 釣果一覧 |
| GET | /api/blog | ブログ一覧 |

### `remaining_count` の定義

```
remaining_count = min( max_capacity - booked_count )  // 影響スロット群すべて
```

- 算出は `src/lib/slots/remaining-count.ts` の `computeRemainingCount` のみ
- UI は API レスポンスをそのまま表示（再計算禁止）

## 認証必須 API

| Method | Path | 説明 |
|---|---|---|
| POST | /api/reservations | 予約作成（DB RPC で原子的にスロット更新） |
| GET | /api/reservations | 予約一覧 |
| PATCH | /api/reservations/[id]/cancel | キャンセル（DB RPC で原子的にスロット更新） |
| POST | /api/checkout | Stripe Checkout（Phase 2） |

### 同時実行対策

予約作成・キャンセルは Supabase RPC（`create_reservation_atomic` / `cancel_reservation_atomic`）で処理する。

- 影響スロットを `FOR UPDATE` で行ロック
- 容量検証 → `booked_count` 更新 → 予約操作を単一トランザクションで実行
- 競合時は `CAPACITY_EXCEEDED`（HTTP 409）を返す

マイグレーション: `supabase/migrations/003_atomic_reservation_rpc.sql`

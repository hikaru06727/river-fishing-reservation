"use client";

import { useActionState, useState } from "react";
import type { SaleRefundRow } from "@/types/database";
import { resolveFailedRefundAction } from "@/app/(admin)/admin/refunds/actions";
import {
  refundInitialState,
  type RefundActionState,
} from "@/app/(admin)/admin/refunds/action-state";

function formatJst(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FailedRefundsPanelProps {
  businessId: string;
  refunds: SaleRefundRow[];
}

/**
 * 「返金失敗・要対応」パネル。
 *
 * cancelReservation() の自動返金は Stripe API 呼び出しが失敗しても予約の
 * キャンセル自体は進める設計になっている（返金失敗でキャンセルをブロックしない
 * 方針）。そのため、この一覧が「返金額がまだお客様に戻っていない」ケースを
 * 検知する唯一の管理画面上の手段になる。
 */
export function FailedRefundsPanel({ businessId, refunds }: FailedRefundsPanelProps) {
  if (refunds.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        対応が必要な返金失敗はありません。
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden>⚠️</span>
        <h3 className="text-sm font-semibold text-red-800">
          返金失敗・要対応（{refunds.length}件）
        </h3>
      </div>
      <p className="text-xs text-red-700">
        予約キャンセル等の際にStripe側で返金処理が失敗した記録です。キャンセル自体は完了済みですが、
        返金額はお客様に戻っていません。手動での返金・連絡が完了したら「対応済みにする」を押してください。
      </p>
      <div className="space-y-2">
        {refunds.map((r) => (
          <FailedRefundRow key={r.id} businessId={businessId} refund={r} />
        ))}
      </div>
    </div>
  );
}

function FailedRefundRow({
  businessId,
  refund,
}: {
  businessId: string;
  refund: SaleRefundRow;
}) {
  const [state, formAction, pending] = useActionState<RefundActionState, FormData>(
    resolveFailedRefundAction,
    refundInitialState,
  );
  const [note, setNote] = useState("");

  return (
    <form action={formAction} className="rounded-lg border border-red-200 bg-white p-3">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="refundId" value={refund.id} />

      <div className="text-xs text-muted">
        <p className="text-sm font-semibold text-foreground">
          ¥{Number(refund.amount).toLocaleString()}
        </p>
        <p>{formatJst(refund.refunded_at)}</p>
        <p className="mt-0.5">{refund.reason ?? "-"}</p>
        {refund.note && (
          <p className="mt-0.5 text-red-600">Stripeエラー内容: {refund.note}</p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="対応メモ（任意）"
          maxLength={500}
          className="min-w-[160px] flex-1 rounded-lg border border-border px-2 py-1.5 text-xs outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={pending}
          className="whitespace-nowrap rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "処理中..." : "対応済みにする"}
        </button>
      </div>

      {state.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-green-700">{state.success}</p>}
    </form>
  );
}

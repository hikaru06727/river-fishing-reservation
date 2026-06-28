"use client";

import type { SaleRefundRow } from "@/types/database";

const METHOD_LABELS: Record<string, string> = {
  cash: "現金",
  card: "カード",
  other: "その他",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "処理中",
  completed: "返金済み",
  failed: "失敗",
};

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

interface RefundDetailModalProps {
  refund: SaleRefundRow;
  onClose: () => void;
}

export function RefundDetailModal({ refund, onClose }: RefundDetailModalProps) {
  const isPostClose = refund.note?.includes("締め後返金") ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">返金詳細</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-slate-100"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-muted">返金日時</dt>
            <dd className="text-right">{formatJst(refund.refunded_at)}</dd>
          </div>

          <div className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-muted">担当者 ID</dt>
            <dd className="font-mono text-xs text-right">{refund.refunded_by}</dd>
          </div>

          <div className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-muted">対象</dt>
            <dd className="text-right">
              {refund.sale_session_id ? (
                <a
                  href={`/admin/products/sales/${refund.sale_session_id}`}
                  className="text-primary hover:underline"
                >
                  POS売上{" "}
                  <span className="font-mono text-xs">
                    {refund.sale_session_id.slice(0, 8)}...
                  </span>
                </a>
              ) : refund.reservation_id ? (
                <a
                  href={`/admin/reservations/${refund.reservation_id}`}
                  className="text-primary hover:underline"
                >
                  予約{" "}
                  <span className="font-mono text-xs">
                    {refund.reservation_id.slice(0, 8)}...
                  </span>
                </a>
              ) : (
                <span className="text-muted">-</span>
              )}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-muted">返金額</dt>
            <dd className="font-semibold">¥{Number(refund.amount).toLocaleString()}</dd>
          </div>

          <div className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-muted">返金方法</dt>
            <dd>{METHOD_LABELS[refund.payment_method] ?? refund.payment_method}</dd>
          </div>

          <div className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-muted">ステータス</dt>
            <dd>{STATUS_LABELS[refund.status] ?? refund.status}</dd>
          </div>

          {refund.reason && (
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-muted">理由</dt>
              <dd className="text-right">{refund.reason}</dd>
            </div>
          )}

          {isPostClose && (
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-muted">フラグ</dt>
              <dd>
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                  締め後返金
                </span>
              </dd>
            </div>
          )}

          {refund.note && (
            <div className="pt-2">
              <dt className="mb-1 text-muted">メモ</dt>
              <dd className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {refund.note}
              </dd>
            </div>
          )}
        </dl>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-border px-4 py-2 text-sm hover:bg-slate-50"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

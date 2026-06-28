"use client";

import { useState } from "react";
import type { SaleRefundRow } from "@/types/database";
import type { SaleRefundStatus } from "@/types/domain";
import { RefundDetailModal } from "@/components/refund/RefundDetailModal";

const STATUS_LABELS: Record<SaleRefundStatus, string> = {
  pending: "処理中",
  completed: "返金済み",
  failed: "失敗",
};

const STATUS_STYLES: Record<SaleRefundStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  completed: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "現金",
  card: "カード",
  other: "その他",
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

interface RefundListViewProps {
  refunds: SaleRefundRow[];
}

export function RefundListView({ refunds }: RefundListViewProps) {
  const [selected, setSelected] = useState<SaleRefundRow | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              <th className="px-4 py-3 text-left font-medium">返金日時</th>
              <th className="px-4 py-3 text-left font-medium">対象</th>
              <th className="px-4 py-3 text-right font-medium">金額</th>
              <th className="px-4 py-3 text-left font-medium">方法</th>
              <th className="px-4 py-3 text-left font-medium">理由</th>
              <th className="px-4 py-3 text-center font-medium">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((r) => {
              const isPostClose = r.note?.includes("締め後返金") ?? false;
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-slate-50/70"
                  onClick={() => setSelected(r)}
                >
                  <td className="px-4 py-3 text-muted">{formatJst(r.refunded_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    <div className="flex items-center gap-1.5">
                      {r.sale_session_id ? "POS売上" : r.reservation_id ? "予約" : "-"}
                      {isPostClose && (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                          締め後
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px]">
                      {(r.sale_session_id ?? r.reservation_id ?? "").slice(0, 8)}
                      {(r.sale_session_id ?? r.reservation_id) ? "..." : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    ¥{Number(r.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {METHOD_LABELS[r.payment_method] ?? r.payment_method}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-muted">
                    {r.reason ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <RefundDetailModal refund={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

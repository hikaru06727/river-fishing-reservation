"use client";

import React, { useActionState } from "react";
import {
  requestCorrectionAction,
  approveCorrectionAction,
} from "@/app/(admin)/admin/register-closing/actions";
import {
  registerClosingInitialState,
  type RegisterClosingActionState,
} from "@/app/(admin)/admin/register-closing/action-state";
import type { RegisterClosingWithDetails } from "@/lib/services/register-closing.service";
import type { RegisterClosingStatus } from "@/types/domain";

const STATUS_LABELS: Record<RegisterClosingStatus, string> = {
  closed: "締め完了",
  correction_requested: "修正申請中",
  approved: "承認済み",
};

const STATUS_STYLES: Record<RegisterClosingStatus, string> = {
  closed: "bg-slate-100 text-slate-700",
  correction_requested: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-700",
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

function StatusBadge({ status }: { status: RegisterClosingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function CorrectionRequestForm({
  closingId,
  businessId,
}: {
  closingId: string;
  businessId: string;
}) {
  const [state, formAction, pending] = useActionState<RegisterClosingActionState, FormData>(
    requestCorrectionAction,
    registerClosingInitialState,
  );

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="closingId" value={closingId} />
      <input type="hidden" name="businessId" value={businessId} />
      <textarea
        name="reason"
        required
        placeholder="修正理由を入力してください"
        rows={2}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-yellow-400 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-800 hover:bg-yellow-100 disabled:opacity-60"
      >
        {pending ? "送信中..." : "修正リクエストを送信"}
      </button>
      {state.error && (
        <p className="text-xs text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-xs text-green-600" role="status">
          {state.success}
        </p>
      )}
    </form>
  );
}

function ApproveButton({
  correctionId,
  businessId,
}: {
  correctionId: string;
  businessId: string;
}) {
  const [state, formAction, pending] = useActionState<RegisterClosingActionState, FormData>(
    approveCorrectionAction,
    registerClosingInitialState,
  );

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="correctionId" value={correctionId} />
        <input type="hidden" name="businessId" value={businessId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-green-400 bg-green-50 px-3 py-1 text-xs font-medium text-green-800 hover:bg-green-100 disabled:opacity-60"
        >
          {pending ? "処理中..." : "承認"}
        </button>
      </form>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="text-xs text-green-600">{state.success}</p>}
    </div>
  );
}

interface ClosingListViewProps {
  closings: RegisterClosingWithDetails[];
  businessId: string;
  canApprove: boolean;
  pendingCorrectionCount: number;
}

export function ClosingListView({
  closings,
  businessId,
  canApprove,
  pendingCorrectionCount,
}: ClosingListViewProps) {
  if (closings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted">
        締め記録がありません。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {canApprove && pendingCorrectionCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800">
          <span>承認待ちの修正リクエストが</span>
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-white">
            {pendingCorrectionCount}
          </span>
          <span>件あります。</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              <th className="px-4 py-3 text-left font-medium">締め日時</th>
              <th className="px-4 py-3 text-left font-medium">対象期間</th>
              <th className="px-4 py-3 text-right font-medium">現金</th>
              <th className="px-4 py-3 text-right font-medium">カード</th>
              <th className="px-4 py-3 text-right font-medium">その他</th>
              <th className="px-4 py-3 text-right font-medium">合計</th>
              <th className="px-4 py-3 text-center font-medium">ステータス</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {closings.map((closing) => {
              const pendingCorrections = closing.corrections.filter(
                (c) => c.status === "pending",
              );

              return (
                <React.Fragment key={closing.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted">{formatJst(closing.closed_at)}</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {formatJst(closing.period_start)}
                      <br />
                      〜 {formatJst(closing.period_end)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ¥{closing.total_cash.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ¥{closing.total_card.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ¥{closing.total_other.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ¥{closing.total_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={closing.status} />
                    </td>
                    <td className="px-4 py-3">
                      {closing.status === "closed" && (
                        <CorrectionRequestForm
                          closingId={closing.id}
                          businessId={businessId}
                        />
                      )}
                      {canApprove &&
                        pendingCorrections.map((correction) => (
                          <div key={correction.id} className="space-y-1">
                            <p className="text-xs text-muted">理由: {correction.reason}</p>
                            <ApproveButton
                              correctionId={correction.id}
                              businessId={businessId}
                            />
                          </div>
                        ))}
                    </td>
                  </tr>
                  {closing.note && (
                    <tr key={`${closing.id}-note`} className="border-b border-border bg-slate-50/50 last:border-0">
                      <td colSpan={8} className="px-4 py-1.5 text-xs text-muted">
                        メモ: {closing.note}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

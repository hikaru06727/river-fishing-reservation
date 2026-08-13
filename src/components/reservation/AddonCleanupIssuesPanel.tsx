"use client";

import { useActionState, useState } from "react";
import type { ReservationAddonCleanupIssueRow } from "@/types/database";
import type { AddonCleanupStep } from "@/types/domain";
import { resolveAddonCleanupIssueAction } from "@/app/(admin)/admin/reservations/actions";
import {
  resolveAddonCleanupIssueInitialState,
  type ResolveAddonCleanupIssueState,
} from "@/types/reservation-action";

const FAILED_STEP_LABELS: Record<AddonCleanupStep, string> = {
  mark_cancelled: "明細のキャンセル処理",
  restore_stock: "在庫の復元",
  update_ledger: "決済台帳の更新",
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

interface AddonCleanupIssuesPanelProps {
  issues: ReservationAddonCleanupIssueRow[];
}

/**
 * 「アドオン後処理失敗・要対応」パネル。
 *
 * cancelAddonItemsAndRestoreStock() は失敗しても予約のキャンセル自体は
 * 進める設計になっている（後処理の失敗でキャンセルをブロックしない方針）。
 * そのため、この一覧が「明細のcancelled化・在庫復元・決済台帳更新のいずれかが
 * 未完了のまま残っている」ケースを検知する唯一の管理画面上の手段になる。
 */
export function AddonCleanupIssuesPanel({ issues }: AddonCleanupIssuesPanelProps) {
  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        対応が必要なアドオン後処理失敗はありません。
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden>⚠️</span>
        <h3 className="text-sm font-semibold text-red-800">
          アドオン後処理失敗・要対応（{issues.length}件）
        </h3>
      </div>
      <p className="text-xs text-red-700">
        予約キャンセル時に、同時購入した商品（アドオン）の後処理の一部が失敗した記録です。
        キャンセル自体は完了済みですが、明細・在庫・決済台帳のいずれかが未整合の可能性があります。
        手動での確認・対応が完了したら「対応済みにする」を押してください。
      </p>
      <div className="space-y-2">
        {issues.map((issue) => (
          <AddonCleanupIssueRow key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  );
}

function AddonCleanupIssueRow({ issue }: { issue: ReservationAddonCleanupIssueRow }) {
  const [state, formAction, pending] = useActionState<ResolveAddonCleanupIssueState, FormData>(
    resolveAddonCleanupIssueAction,
    resolveAddonCleanupIssueInitialState,
  );
  const [note, setNote] = useState("");

  return (
    <form action={formAction} className="rounded-lg border border-red-200 bg-white p-3">
      <input type="hidden" name="businessId" value={issue.business_id} />
      <input type="hidden" name="issueId" value={issue.id} />

      <div className="text-xs text-muted">
        <p className="text-sm font-semibold text-foreground">予約ID: {issue.reservation_id}</p>
        <p>{formatJst(issue.created_at)}</p>
        <p className="mt-0.5">
          失敗したステップ:{" "}
          {issue.failed_steps.map((step) => FAILED_STEP_LABELS[step]).join("、")}
        </p>
        {issue.detail && <p className="mt-0.5 text-red-600">エラー内容: {issue.detail}</p>}
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

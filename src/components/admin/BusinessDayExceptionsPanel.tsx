"use client";

import { useActionState } from "react";
import {
  adminBusinessHoursActionInitialState,
  type AdminBusinessHoursActionState,
} from "@/app/(admin)/admin/business-hours/action-state";
import {
  deleteDateExceptionAction,
  saveDateExceptionAction,
} from "@/app/(admin)/admin/business-hours/actions";
import { Button } from "@/components/ui/Button";
import type { FishingSpotDateException } from "@/types/database";

function formatTimeRange(row: FishingSpotDateException): string {
  if (!row.is_open) {
    return "休業";
  }
  if (row.is_24_hours) {
    return "24時間営業";
  }
  const open = row.open_time?.slice(0, 5) ?? "--:--";
  const close = row.close_time?.slice(0, 5) ?? "--:--";
  return `${open} 〜 ${close}`;
}

interface BusinessDayExceptionsPanelProps {
  spotId: string;
  exceptions: FishingSpotDateException[];
  actionState?: AdminBusinessHoursActionState;
}

export function BusinessDayExceptionsPanel({
  spotId,
  exceptions,
  actionState,
}: BusinessDayExceptionsPanelProps) {
  const [createState, createAction, createPending] = useActionState(
    saveDateExceptionAction,
    adminBusinessHoursActionInitialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteDateExceptionAction,
    adminBusinessHoursActionInitialState,
  );

  const message =
    createState.error ??
    createState.success ??
    deleteState.error ??
    deleteState.success ??
    actionState?.error ??
    actionState?.success;
  const isError = Boolean(
    createState.error ?? deleteState.error ?? actionState?.error,
  );

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">例外日</h3>
        <p className="mt-1 text-sm text-muted">
          臨時休業・短縮営業・祝日営業など。例外日は曜日設定より優先されます。
        </p>
      </div>

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </p>
      )}

      {exceptions.length === 0 ? (
        <p className="text-sm text-muted">例外日はまだ登録されていません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-2 py-2">日付</th>
                <th className="px-2 py-2">設定</th>
                <th className="px-2 py-2">メモ</th>
                <th className="px-2 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="px-2 py-2">{row.exception_date}</td>
                  <td className="px-2 py-2">{formatTimeRange(row)}</td>
                  <td className="px-2 py-2">{row.note ?? "—"}</td>
                  <td className="px-2 py-2">
                    <form action={deleteAction} className="inline">
                      <input type="hidden" name="fishingSpotId" value={spotId} />
                      <input type="hidden" name="exceptionId" value={row.id} />
                      <button
                        type="submit"
                        disabled={deletePending}
                        className="text-sm text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form action={createAction} className="space-y-3 rounded-lg border border-dashed border-border p-4">
        <h4 className="text-sm font-semibold">例外日を追加</h4>
        <input type="hidden" name="fishingSpotId" value={spotId} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="exceptionDate" className="block text-xs font-medium text-muted">
              日付
            </label>
            <input
              id="exceptionDate"
              name="exceptionDate"
              type="date"
              required
              className="mt-1 w-full min-h-10 rounded-lg border border-border px-3 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isOpen" className="h-4 w-4" />
              営業する
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is24Hours" className="h-4 w-4" />
              24時間営業
            </label>
          </div>
          <div>
            <label htmlFor="openTime" className="block text-xs font-medium text-muted">
              開店
            </label>
            <input
              id="openTime"
              name="openTime"
              type="time"
              defaultValue="09:00"
              className="mt-1 w-full min-h-10 rounded-lg border border-border px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="closeTime" className="block text-xs font-medium text-muted">
              閉店
            </label>
            <input
              id="closeTime"
              name="closeTime"
              type="time"
              defaultValue="17:00"
              className="mt-1 w-full min-h-10 rounded-lg border border-border px-3 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="note" className="block text-xs font-medium text-muted">
            メモ
          </label>
          <input
            id="note"
            name="note"
            type="text"
            placeholder="例: 臨時休業"
            className="mt-1 w-full min-h-10 rounded-lg border border-border px-3 text-sm"
          />
        </div>

        <Button type="submit" disabled={createPending}>
          {createPending ? "追加中..." : "例外日を追加"}
        </Button>
      </form>
    </section>
  );
}

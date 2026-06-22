"use client";

import { Fragment, useActionState, useState } from "react";
import {
  adminBusinessHoursActionInitialState,
  type AdminBusinessHoursActionState,
} from "@/app/(admin)/admin/business-hours/action-state";
import {
  deleteDateExceptionAction,
  saveDateExceptionAction,
} from "@/app/(admin)/admin/business-hours/actions";
import { Button } from "@/components/ui/Button";
import {
  DATE_EXCEPTION_TAG_OPTIONS,
  getDateExceptionTagLabel,
} from "@/lib/business-hours/date-exception-tags";
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

function TagTypeSelect({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue ?? ""}
      className="mt-1 w-full min-h-10 rounded-lg border border-border bg-background px-3 text-sm"
    >
      {DATE_EXCEPTION_TAG_OPTIONS.map((option) => (
        <option key={option.value || "unset"} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function DateExceptionFormFields({
  row,
  idPrefix,
}: {
  row?: FishingSpotDateException;
  idPrefix: string;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-exceptionDate`} className="block text-xs font-medium text-muted">
            日付
          </label>
          <input
            id={`${idPrefix}-exceptionDate`}
            name="exceptionDate"
            type="date"
            required
            defaultValue={row?.exception_date}
            className="mt-1 w-full min-h-10 rounded-lg border border-border px-3 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-tagType`} className="block text-xs font-medium text-muted">
            タグ
          </label>
          <TagTypeSelect
            id={`${idPrefix}-tagType`}
            name="tagType"
            defaultValue={row?.tag_type}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isOpen"
              defaultChecked={row?.is_open}
              className="h-4 w-4"
            />
            営業する
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is24Hours"
              defaultChecked={row?.is_24_hours}
              className="h-4 w-4"
            />
            24時間営業
          </label>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-openTime`} className="block text-xs font-medium text-muted">
            開店
          </label>
          <input
            id={`${idPrefix}-openTime`}
            name="openTime"
            type="time"
            defaultValue={row?.open_time?.slice(0, 5) ?? "09:00"}
            className="mt-1 w-full min-h-10 rounded-lg border border-border px-3 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-closeTime`} className="block text-xs font-medium text-muted">
            閉店
          </label>
          <input
            id={`${idPrefix}-closeTime`}
            name="closeTime"
            type="time"
            defaultValue={row?.close_time?.slice(0, 5) ?? "17:00"}
            className="mt-1 w-full min-h-10 rounded-lg border border-border px-3 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-note`} className="block text-xs font-medium text-muted">
          メモ
        </label>
        <input
          id={`${idPrefix}-note`}
          name="note"
          type="text"
          defaultValue={row?.note ?? ""}
          placeholder="例: 臨時休業"
          className="mt-1 w-full min-h-10 rounded-lg border border-border px-3 text-sm"
        />
      </div>
    </>
  );
}

function DateExceptionEditRow({
  spotId,
  row,
  onCancel,
}: {
  spotId: string;
  row: FishingSpotDateException;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveDateExceptionAction,
    adminBusinessHoursActionInitialState,
  );

  return (
    <tr className="border-b border-border/60 bg-muted/20">
      <td colSpan={5} className="px-2 py-3">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="fishingSpotId" value={spotId} />
          <input type="hidden" name="exceptionId" value={row.id} />
          <h4 className="text-sm font-semibold">例外日を編集 — {row.exception_date}</h4>
          <DateExceptionFormFields row={row} idPrefix={`edit-${row.id}`} />
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}
          {state.success && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {state.success}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "保存中..." : "変更を保存"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              キャンセル
            </Button>
          </div>
        </form>
      </td>
    </tr>
  );
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
  const [editingId, setEditingId] = useState<string | null>(null);
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
          臨時休業・短縮営業・祝日営業など。例外日は曜日設定より優先されます。タグはカレンダー表示用です。
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
                <th className="px-2 py-2">タグ</th>
                <th className="px-2 py-2">メモ</th>
                <th className="px-2 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-border/60">
                    <td className="px-2 py-2">{row.exception_date}</td>
                    <td className="px-2 py-2">{formatTimeRange(row)}</td>
                    <td className="px-2 py-2">{getDateExceptionTagLabel(row.tag_type)}</td>
                    <td className="px-2 py-2">{row.note ?? "—"}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingId((current) => (current === row.id ? null : row.id))
                          }
                          className="text-sm text-primary hover:underline"
                        >
                          {editingId === row.id ? "閉じる" : "編集"}
                        </button>
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
                      </div>
                    </td>
                  </tr>
                  {editingId === row.id && (
                    <DateExceptionEditRow
                      spotId={spotId}
                      row={row}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form action={createAction} className="space-y-3 rounded-lg border border-dashed border-border p-4">
        <h4 className="text-sm font-semibold">例外日を追加</h4>
        <input type="hidden" name="fishingSpotId" value={spotId} />
        <DateExceptionFormFields idPrefix="create" />

        <Button type="submit" disabled={createPending}>
          {createPending ? "追加中..." : "例外日を追加"}
        </Button>
      </form>
    </section>
  );
}

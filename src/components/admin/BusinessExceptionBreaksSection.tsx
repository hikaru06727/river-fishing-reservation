"use client";

import { useActionState, useState } from "react";
import {
  adminBusinessHoursActionInitialState,
} from "@/app/(admin)/admin/business-hours/action-state";
import { saveExceptionBreaksAction } from "@/app/(admin)/admin/business-hours/actions";
import { Button } from "@/components/ui/Button";
import type {
  LocationDateException,
  LocationExceptionBreak,
} from "@/types/database";

type BreakRowState = {
  key: string;
  startTime: string;
  endTime: string;
  label: string;
};

function toRows(existing: LocationExceptionBreak[]): BreakRowState[] {
  return existing.map((row) => ({
    key: row.id,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    label: row.label ?? "",
  }));
}

interface BusinessExceptionBreaksEditorProps {
  spotId: string;
  exception: LocationDateException;
  breaks: LocationExceptionBreak[];
}

export function BusinessExceptionBreaksEditor({
  spotId,
  exception,
  breaks,
}: BusinessExceptionBreaksEditorProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    saveExceptionBreaksAction,
    adminBusinessHoursActionInitialState,
  );
  const [rows, setRows] = useState<BreakRowState[]>(() => toRows(breaks));
  const [ignoreWeeklyBreaks, setIgnoreWeeklyBreaks] = useState(
    exception.ignore_weekly_breaks,
  );

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${prev.length}`,
        startTime: "12:00",
        endTime: "13:00",
        label: "臨時休憩",
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function updateRow(key: string, patch: Partial<BreakRowState>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{exception.exception_date}</p>
          <p className="text-xs text-muted">
            休み時間 {breaks.length} 件
            {exception.ignore_weekly_breaks ? " / 曜日休み無視" : " / 曜日休み継承可"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {open ? "閉じる" : "休み時間を編集"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}
          {state.success && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {state.success}
            </p>
          )}

          <form action={formAction} className="space-y-3">
            <input type="hidden" name="fishingSpotId" value={spotId} />
            <input type="hidden" name="exceptionId" value={exception.id} />
            <input type="hidden" name="exceptionBreakCount" value={String(rows.length)} />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="ignoreWeeklyBreaks"
                checked={ignoreWeeklyBreaks}
                onChange={(e) => setIgnoreWeeklyBreaks(e.target.checked)}
                className="h-4 w-4"
              />
              この例外日では曜日別の休み時間を使わない
            </label>

            {rows.length === 0 ? (
              <p className="text-sm text-muted">例外日の休み時間は未登録です。</p>
            ) : (
              rows.map((row, index) => (
                <div
                  key={row.key}
                  className="grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <div>
                    <label className="block text-xs font-medium text-muted">開始</label>
                    <input
                      type="time"
                      name={`exceptionBreak_${index}_startTime`}
                      value={row.startTime}
                      onChange={(e) => updateRow(row.key, { startTime: e.target.value })}
                      className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted">終了</label>
                    <input
                      type="time"
                      name={`exceptionBreak_${index}_endTime`}
                      value={row.endTime}
                      onChange={(e) => updateRow(row.key, { endTime: e.target.value })}
                      className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted">ラベル</label>
                    <input
                      type="text"
                      name={`exceptionBreak_${index}_label`}
                      value={row.label}
                      onChange={(e) => updateRow(row.key, { label: e.target.value })}
                      className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={addRow}>
                休み時間を追加
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "保存中..." : "例外日の休み時間を保存"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

interface BusinessExceptionBreaksSectionProps {
  spotId: string;
  exceptions: LocationDateException[];
  exceptionBreaksByExceptionId: Record<string, LocationExceptionBreak[]>;
}

export function BusinessExceptionBreaksSection({
  spotId,
  exceptions,
  exceptionBreaksByExceptionId,
}: BusinessExceptionBreaksSectionProps) {
  if (exceptions.length === 0) {
    return (
      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h3 className="text-base font-semibold text-foreground">例外日の休み時間</h3>
        <p className="text-sm text-muted">例外日を登録すると、日別の休み時間を設定できます。</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">例外日の休み時間</h3>
        <p className="mt-1 text-sm text-muted">
          例外日ごとに休み時間を設定できます。営業日設定とは別ボタンで保存してください。
        </p>
      </div>
      <div className="space-y-3">
        {exceptions.map((exception) => (
          <BusinessExceptionBreaksEditor
            key={exception.id}
            spotId={spotId}
            exception={exception}
            breaks={exceptionBreaksByExceptionId[exception.id] ?? []}
          />
        ))}
      </div>
    </section>
  );
}

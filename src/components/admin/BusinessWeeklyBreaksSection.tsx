"use client";

import { useActionState, useMemo, useState } from "react";
import { adminBusinessHoursActionInitialState } from "@/app/(admin)/admin/business-hours/action-state";
import { saveWeeklyBreaksAction } from "@/app/(admin)/admin/business-hours/actions";
import { Button } from "@/components/ui/Button";
import type { LocationWeeklyBreak } from "@/types/database";

const DAY_LABELS = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"] as const;

type BreakRowState = {
  key: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
};

function toRows(existing: LocationWeeklyBreak[]): BreakRowState[] {
  return existing.map((row) => ({
    key: row.id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    label: row.label ?? "",
  }));
}

interface BusinessWeeklyBreaksSectionProps {
  spotId: string;
  weeklyBreaks: LocationWeeklyBreak[];
}

export function BusinessWeeklyBreaksSection({
  spotId,
  weeklyBreaks,
}: BusinessWeeklyBreaksSectionProps) {
  const [state, formAction, pending] = useActionState(
    saveWeeklyBreaksAction,
    adminBusinessHoursActionInitialState,
  );
  const [rows, setRows] = useState<BreakRowState[]>(() => toRows(weeklyBreaks));

  const isConfigured = useMemo(() => weeklyBreaks.length > 0, [weeklyBreaks]);

  function addRow(dayOfWeek: number) {
    setRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${prev.length}`,
        dayOfWeek,
        startTime: "12:00",
        endTime: "13:00",
        label: "昼休み",
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
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">曜日別休み時間</h3>
        <p className="mt-1 text-sm text-muted">
          {isConfigured
            ? "昼休み・清掃時間など、予約不可の時間帯を設定できます。営業時間とは別に保存してください。"
            : "未設定の場合は休み時間による制限はありません。保存すると予約候補に反映されます。"}
        </p>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="fishingSpotId" value={spotId} />
        <input type="hidden" name="weeklyBreakCount" value={String(rows.length)} />

        {rows.length === 0 ? (
          <p className="text-sm text-muted">休み時間はまだ登録されていません。</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div
                key={row.key}
                className="grid gap-3 rounded-lg border border-border/70 p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              >
                <input type="hidden" name={`weeklyBreak_${index}_dayOfWeek`} value={row.dayOfWeek} />
                <div>
                  <label className="block text-xs font-medium text-muted">曜日</label>
                  <select
                    value={row.dayOfWeek}
                    onChange={(e) =>
                      updateRow(row.key, { dayOfWeek: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm"
                  >
                    {DAY_LABELS.map((label, dayOfWeek) => (
                      <option key={label} value={dayOfWeek}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted">開始</label>
                  <input
                    type="time"
                    name={`weeklyBreak_${index}_startTime`}
                    value={row.startTime}
                    onChange={(e) => updateRow(row.key, { startTime: e.target.value })}
                    className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted">終了</label>
                  <input
                    type="time"
                    name={`weeklyBreak_${index}_endTime`}
                    value={row.endTime}
                    onChange={(e) => updateRow(row.key, { endTime: e.target.value })}
                    className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted">ラベル</label>
                  <input
                    type="text"
                    name={`weeklyBreak_${index}_label`}
                    value={row.label}
                    onChange={(e) => updateRow(row.key, { label: e.target.value })}
                    placeholder="昼休み"
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
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((label, dayOfWeek) => (
            <Button
              key={label}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => addRow(dayOfWeek)}
            >
              {label}に追加
            </Button>
          ))}
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "保存中..." : "曜日別休み時間を保存"}
        </Button>
      </form>
    </section>
  );
}

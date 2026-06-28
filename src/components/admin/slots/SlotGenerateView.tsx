"use client";

import { useActionState } from "react";
import type { GenerateSlotsState } from "@/actions/slots";
import { generateSlotsAction } from "@/actions/slots";

interface SpotOption {
  id: string;
  name: string;
}

interface SlotGenerateViewProps {
  spots: SpotOption[];
}

const initialState: GenerateSlotsState = { status: "idle" };

const inputClass =
  "mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
const selectClass =
  "mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SlotGenerateView({ spots }: SlotGenerateViewProps) {
  const [state, formAction, pending] = useActionState(generateSlotsAction, initialState);

  if (spots.length === 0) {
    return (
      <p className="text-muted text-sm">
        釣り場が登録されていません。先に釣り場を作成してください。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">予約枠生成</h2>
        <p className="mt-1 text-sm text-muted">
          各釣り場に設定された曜日別営業時間（location_weekly_hours）を元に
          15 分刻みの予約枠を生成します。既存の枠は重複挿入されません。
        </p>
      </div>

      <form action={formAction} className="mx-auto max-w-lg space-y-4">
        <div>
          <label htmlFor="spotId" className="block text-sm font-medium">
            釣り場 <span className="text-red-600">*</span>
          </label>
          <select id="spotId" name="spotId" required className={selectClass}>
            <option value="">選択してください</option>
            {spots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="fromDate" className="block text-sm font-medium">
              開始日 <span className="text-red-600">*</span>
            </label>
            <input
              id="fromDate"
              name="fromDate"
              type="date"
              required
              defaultValue={todayIso()}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="toDate" className="block text-sm font-medium">
              終了日 <span className="text-red-600">*</span>
            </label>
            <input
              id="toDate"
              name="toDate"
              type="date"
              required
              defaultValue={addDaysIso(30)}
              className={inputClass}
            />
          </div>
        </div>

        {state.status === "error" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </p>
        )}

        {state.status === "success" && (
          <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {state.inserted === 0
              ? "新規に生成された枠はありませんでした（既存の枠と重複）。"
              : `${state.inserted} 件の予約枠を生成しました。`}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "生成中..." : "予約枠を生成"}
        </button>
      </form>
    </div>
  );
}

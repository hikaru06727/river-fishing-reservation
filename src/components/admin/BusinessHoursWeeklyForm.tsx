"use client";

import { useActionState } from "react";
import {
  adminBusinessHoursActionInitialState,
  type AdminBusinessHoursActionState,
} from "@/app/(admin)/admin/business-hours/action-state";
import { saveWeeklyHoursAction } from "@/app/(admin)/admin/business-hours/actions";
import { Button } from "@/components/ui/Button";
import type { FishingSpotWeeklyHour } from "@/types/database";

const DAY_LABELS = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"] as const;

type DayFormState = {
  dayOfWeek: number;
  isOpen: boolean;
  is24Hours: boolean;
  openTime: string;
  closeTime: string;
};

function defaultDayState(dayOfWeek: number, existing?: FishingSpotWeeklyHour): DayFormState {
  if (existing) {
    return {
      dayOfWeek,
      isOpen: existing.is_open,
      is24Hours: existing.is_24_hours,
      openTime: existing.open_time?.slice(0, 5) ?? "09:00",
      closeTime: existing.close_time?.slice(0, 5) ?? "17:00",
    };
  }

  const weekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  return {
    dayOfWeek,
    isOpen: weekday,
    is24Hours: false,
    openTime: "09:00",
    closeTime: "17:00",
  };
}

interface BusinessHoursWeeklyFormProps {
  spotId: string;
  weeklyHours: FishingSpotWeeklyHour[];
  actionState?: AdminBusinessHoursActionState;
}

export function BusinessHoursWeeklyForm({
  spotId,
  weeklyHours,
  actionState,
}: BusinessHoursWeeklyFormProps) {
  const [state, formAction, pending] = useActionState(
    saveWeeklyHoursAction,
    adminBusinessHoursActionInitialState,
  );

  const message = state.error ?? state.success ?? actionState?.error ?? actionState?.success;
  const isError = Boolean(state.error ?? actionState?.error);

  const days = Array.from({ length: 7 }, (_, dayOfWeek) =>
    defaultDayState(
      dayOfWeek,
      weeklyHours.find((row) => row.day_of_week === dayOfWeek),
    ),
  );

  const isConfigured = weeklyHours.length > 0;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">曜日別営業時間</h3>
        <p className="mt-1 text-sm text-muted">
          {isConfigured
            ? "保存済みの設定があります。変更後に保存してください。"
            : "未設定の釣り場は従来どおり予約できます。保存すると営業時間が適用されます。"}
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

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="fishingSpotId" value={spotId} />

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-2 py-2">曜日</th>
                <th className="px-2 py-2">営業</th>
                <th className="px-2 py-2">24時間</th>
                <th className="px-2 py-2">開店</th>
                <th className="px-2 py-2">閉店</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.dayOfWeek} className="border-b border-border/60">
                  <td className="px-2 py-2 font-medium">{DAY_LABELS[day.dayOfWeek]}</td>
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      name={`day_${day.dayOfWeek}_isOpen`}
                      defaultChecked={day.isOpen}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      name={`day_${day.dayOfWeek}_is24Hours`}
                      defaultChecked={day.is24Hours}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="time"
                      name={`day_${day.dayOfWeek}_openTime`}
                      defaultValue={day.openTime}
                      className="rounded border border-border px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="time"
                      name={`day_${day.dayOfWeek}_closeTime`}
                      defaultValue={day.closeTime}
                      className="rounded border border-border px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "保存中..." : "曜日別設定を保存"}
        </Button>
      </form>
    </section>
  );
}

"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  adminPlanActionInitialState,
  type AdminPlanActionState,
} from "@/app/(admin)/admin/plans/action-state";
import { Button } from "@/components/ui/Button";
import type { ManageableSpotRow } from "@/lib/repositories/businesses.repository";
import type { Plan } from "@/types/database";

interface PlanFormProps {
  action: (
    prevState: AdminPlanActionState,
    formData: FormData,
  ) => Promise<AdminPlanActionState>;
  spots: ManageableSpotRow[];
  plan?: Plan;
  isLegacyGlobalPlan?: boolean;
  returnTo?: string;
  submitLabel: string;
}

export function PlanForm({
  action,
  spots,
  plan,
  isLegacyGlobalPlan = false,
  returnTo = "/admin/plans",
  submitLabel,
}: PlanFormProps) {
  const [state, formAction, pending] = useActionState(action, adminPlanActionInitialState);

  return (
    <form action={formAction} className="mx-auto max-w-lg space-y-4">
      {plan && <input type="hidden" name="planId" value={plan.id} />}
      {isLegacyGlobalPlan && <input type="hidden" name="legacyGlobalPlan" value="true" />}
      <input type="hidden" name="returnTo" value={returnTo} />

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          プラン名 <span className="text-red-600">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={plan?.name ?? ""}
          className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          説明
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={plan?.description ?? ""}
          className="mt-1 w-full rounded-xl border border-border p-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="priceYen" className="block text-sm font-medium">
            料金（円） <span className="text-red-600">*</span>
          </label>
          <input
            id="priceYen"
            name="priceYen"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={plan?.price_yen ?? ""}
            className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="durationMinutes" className="block text-sm font-medium">
            所要時間（分） <span className="text-red-600">*</span>
          </label>
          <input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={1}
            step={1}
            required
            defaultValue={plan?.duration_minutes ?? ""}
            className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label htmlFor="maxGuests" className="block text-sm font-medium">
          最大人数 <span className="text-red-600">*</span>
        </label>
        <input
          id="maxGuests"
          name="maxGuests"
          type="number"
          min={1}
          step={1}
          required
          defaultValue={plan?.max_guests ?? 1}
          className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="fishingSpotId" className="block text-sm font-medium">
          対象釣り場 <span className="text-red-600">*</span>
        </label>
        {isLegacyGlobalPlan ? (
          <>
            <input type="hidden" name="fishingSpotId" value="" />
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              共通プラン（レガシー）のため、釣り場の変更はできません。
            </p>
          </>
        ) : (
          <select
            id="fishingSpotId"
            name="fishingSpotId"
            required
            defaultValue={plan?.location_id ?? ""}
            className="mt-1 w-full min-h-12 rounded-xl border border-border px-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="" disabled>
              選択してください
            </option>
            {spots.map((spot) => (
              <option key={spot.id} value={spot.id}>
                {spot.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-border p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            name="isVisible"
            type="checkbox"
            defaultChecked={plan?.is_visible ?? true}
          />
          公開画面に表示する
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            name="isAcceptingReservations"
            type="checkbox"
            defaultChecked={plan?.is_accepting_reservations ?? true}
          />
          新規予約を受け付ける
        </label>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={pending} className="min-h-12 flex-1">
          {pending ? "保存中..." : submitLabel}
        </Button>
        <Link
          href={returnTo}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-slate-50"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}

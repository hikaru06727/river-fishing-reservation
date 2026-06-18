"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  togglePlanAcceptingReservationsAction,
  togglePlanVisibilityAction,
} from "@/app/(admin)/admin/plans/actions";
import { adminPlanActionInitialState } from "@/app/(admin)/admin/plans/actions";
import { Button } from "@/components/ui/Button";
import type { AdminPlanRow } from "@/lib/plans/get-admin-plans";
import { formatDuration } from "@/lib/utils/plan";
import { formatDateTime, formatYen } from "@/lib/utils/format";

interface AdminPlansTableProps {
  plans: AdminPlanRow[];
  returnTo?: string;
  canEditGlobalPlans?: boolean;
}

function PlanStatusBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function ToggleVisibilityButton({
  planId,
  isVisible,
  returnTo,
}: {
  planId: string;
  isVisible: boolean;
  returnTo: string;
}) {
  const [state, formAction, pending] = useActionState(
    togglePlanVisibilityAction,
    adminPlanActionInitialState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="isVisible" value={isVisible ? "false" : "true"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "..." : isVisible ? "非表示" : "表示"}
      </Button>
      {state.error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

function ToggleAcceptingButton({
  planId,
  isAcceptingReservations,
  returnTo,
}: {
  planId: string;
  isAcceptingReservations: boolean;
  returnTo: string;
}) {
  const [state, formAction, pending] = useActionState(
    togglePlanAcceptingReservationsAction,
    adminPlanActionInitialState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="planId" value={planId} />
      <input
        type="hidden"
        name="isAcceptingReservations"
        value={isAcceptingReservations ? "false" : "true"}
      />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "..." : isAcceptingReservations ? "受付停止" : "受付再開"}
      </Button>
      {state.error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function AdminPlansTable({
  plans,
  returnTo = "/admin/plans",
  canEditGlobalPlans = false,
}: AdminPlansTableProps) {
  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted">
        条件に一致するプランがありません。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="border-b border-border bg-slate-50 text-xs text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">プラン名</th>
            <th className="px-4 py-3 font-medium">釣り場</th>
            <th className="px-4 py-3 font-medium">料金</th>
            <th className="px-4 py-3 font-medium">所要時間</th>
            <th className="px-4 py-3 font-medium">最大人数</th>
            <th className="px-4 py-3 font-medium">表示</th>
            <th className="px-4 py-3 font-medium">予約受付</th>
            <th className="px-4 py-3 font-medium">更新日時</th>
            <th className="px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {plans.map((plan) => {
            const isGlobalPlan = plan.fishing_spot_id == null;
            const canEdit = !isGlobalPlan || canEditGlobalPlans;

            return (
              <tr key={plan.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <div className="font-medium">{plan.name}</div>
                  {plan.description && (
                    <div className="mt-1 line-clamp-2 text-xs text-muted">{plan.description}</div>
                  )}
                  {isGlobalPlan && (
                    <div className="mt-1 text-xs text-amber-700">共通プラン（レガシー）</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {plan.fishing_spots?.name ?? "共通（全釣り場）"}
                </td>
                <td className="px-4 py-3">{formatYen(plan.price_yen)}</td>
                <td className="px-4 py-3">{formatDuration(plan.duration_minutes)}</td>
                <td className="px-4 py-3">{plan.max_guests} 名</td>
                <td className="px-4 py-3">
                  <PlanStatusBadge
                    active={plan.is_visible}
                    activeLabel="表示中"
                    inactiveLabel="非表示"
                  />
                </td>
                <td className="px-4 py-3">
                  <PlanStatusBadge
                    active={plan.is_accepting_reservations}
                    activeLabel="受付中"
                    inactiveLabel="停止中"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">
                  {formatDateTime(plan.updated_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    {canEdit ? (
                      <>
                        <Link
                          href={`/admin/plans/${plan.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
                          className="text-primary hover:underline"
                        >
                          編集
                        </Link>
                        <ToggleVisibilityButton
                          planId={plan.id}
                          isVisible={plan.is_visible}
                          returnTo={returnTo}
                        />
                        <ToggleAcceptingButton
                          planId={plan.id}
                          isAcceptingReservations={plan.is_accepting_reservations}
                          returnTo={returnTo}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-muted">操作不可</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PlanForm } from "@/components/admin/PlanForm";
import { createAdminPlanAction } from "../actions";
import { getSelectableSpotsForPlans } from "@/lib/plans/get-admin-plans";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "プラン作成" };

export default async function AdminPlansNewPage() {
  const spots = await getSelectableSpotsForPlans();

  return (
    <div>
      <Link href="/admin/plans" className="text-sm text-primary hover:underline">
        ← プラン管理
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-foreground">プランを作成</h2>
      <p className="mt-1 text-sm text-muted">
        担当釣り場向けのプランを作成します。共通プラン（1h/3h）はレガシーとして別管理です。
      </p>
      <div className="mt-8">
        {spots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-6 py-8 text-sm text-muted">
            操作可能な釣り場がありません。事業割当を確認してください。
          </p>
        ) : (
          <PlanForm
            action={createAdminPlanAction}
            spots={spots}
            submitLabel="作成する"
          />
        )}
      </div>
    </div>
  );
}

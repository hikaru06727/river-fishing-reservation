import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlanForm } from "@/components/admin/PlanForm";
import { updateAdminPlanAction } from "../../actions";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { isAdminRole } from "@/lib/auth/role";
import { getAdminPlanForEdit } from "@/lib/services/plans.service";
import { getSelectableSpotsForPlans } from "@/lib/plans/get-admin-plans";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "プラン編集" };

interface AdminPlanEditPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}

function sanitizeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith("/admin/plans")) {
    return "/admin/plans";
  }
  return value;
}

export default async function AdminPlanEditPage({
  params,
  searchParams,
}: AdminPlanEditPageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) {
    redirect("/admin/login?next=/admin/plans");
  }

  const { id } = await params;
  const { returnTo: returnToParam } = await searchParams;
  const returnTo = sanitizeReturnTo(returnToParam);

  const [result, spots] = await Promise.all([
    getAdminPlanForEdit(session.profile, id),
    getSelectableSpotsForPlans(),
  ]);

  if (!result.ok) {
    if (result.status === 404) {
      notFound();
    }
    if (result.status === 403) {
      redirect("/admin/plans");
    }
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {result.error}
      </div>
    );
  }

  const plan = result.data;
  if (!plan) {
    notFound();
  }

  const isLegacyGlobalPlan = plan.location_id == null;
  if (isLegacyGlobalPlan && !isAdminRole(session.profile.role)) {
    redirect("/admin/plans");
  }

  return (
    <div>
      <Link href={returnTo} className="text-sm text-primary hover:underline">
        ← プラン管理
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-foreground">プランを編集</h2>
      {isLegacyGlobalPlan && (
        <p className="mt-1 text-sm text-amber-800">
          共通プラン（レガシー）です。料金変更は既存予約の total_amount_yen には影響しません。
        </p>
      )}
      <div className="mt-8">
        <PlanForm
          action={updateAdminPlanAction}
          spots={spots}
          plan={plan}
          isLegacyGlobalPlan={isLegacyGlobalPlan}
          returnTo={returnTo}
          submitLabel="更新する"
        />
      </div>
    </div>
  );
}

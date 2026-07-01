import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ManualSaleForm } from "@/components/admin/ManualSaleForm";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { deleteManualSaleAction, updateManualSaleAction } from "../../actions";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import {
  findManageableBusinesses,
  findManageableSpots,
} from "@/lib/repositories/businesses.repository";
import { findManualSaleById } from "@/lib/repositories/manual-sales.repository";
import { getCurrentTaxRate } from "@/lib/repositories/tax-rates.repository";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { findAssignedBusinessIdsByStaffUserId } from "@/lib/repositories/staff-members.repository";
import { isAdminRole, isStaffRole } from "@/lib/auth/role";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "手動売上 編集" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminManualSalesEditPage({ params }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/manual-sales");

  const { id } = await params;

  const [sale, businesses, locations, taxRate] = await Promise.all([
    findManualSaleById(id),
    findManageableBusinesses(),
    findManageableSpots(),
    getCurrentTaxRate(),
  ]);

  if (!sale) notFound();

  const assignedIds = isAdminRole(session.profile.role)
    ? []
    : isStaffRole(session.profile.role)
      ? await findAssignedBusinessIdsByStaffUserId(session.profile.id)
      : await findAssignedBusinessIdsByUserId(session.profile.id);

  if (!canManageBusinessForProfile(session.profile, sale.business_id, assignedIds)) {
    redirect("/admin/manual-sales");
  }

  const currentTaxRate = taxRate?.rate_percent ?? 10;
  const returnPath = `/admin/manual-sales?businessId=${sale.business_id}`;

  return (
    <div>
      <Link href={returnPath} className="text-sm text-primary hover:underline">
        ← 手動売上管理
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-foreground">手動売上 編集</h2>

      <div className="mt-8">
        <ManualSaleForm
          action={updateManualSaleAction}
          businesses={businesses}
          locations={locations}
          currentTaxRate={currentTaxRate}
          sale={sale}
          submitLabel="更新する"
        />
      </div>

      <div className="mx-auto mt-8 max-w-lg">
        <p className="mb-2 text-xs text-muted">この売上を削除する場合:</p>
        <form action={deleteManualSaleAction}>
          <input type="hidden" name="id" value={sale.id} />
          <input type="hidden" name="businessId" value={sale.business_id} />
          <DeleteConfirmButton message="この売上を削除してよろしいですか？" />
        </form>
      </div>
    </div>
  );
}

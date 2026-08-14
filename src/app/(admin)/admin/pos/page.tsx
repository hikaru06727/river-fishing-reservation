import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PosTerminal } from "@/components/admin/PosTerminal";
import { createSaleSessionAction } from "./actions";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { findProductSalesCountsByBusinessId, findProductsByBusinessId } from "@/lib/repositories/products.repository";
import { getCurrentTaxRate } from "@/lib/repositories/tax-rates.repository";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import { findAssignedBusinessIdsByStaffUserId } from "@/lib/repositories/staff-members.repository";
import { isAdminRole, isStaffRole } from "@/lib/auth/role";
import { SINGLE_BUSINESS_ID } from "@/lib/feature-flags";
import type { Product } from "@/types/database";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "レジ" };

export default async function AdminPosPage() {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/login?next=/admin/pos");

  const isAdmin = isAdminRole(session.profile.role);

  const businesses = await findManageableBusinesses();
  const business = businesses[0];

  let products: Product[] = [];
  let salesCounts: Record<string, number> = {};
  let accessError: string | null = null;
  let taxRatePercent = 10;

  if (business) {
    const isStaff = isStaffRole(session.profile.role);
    const assignedIds = isAdmin
      ? []
      : isStaff
        ? await findAssignedBusinessIdsByStaffUserId(session.profile.id)
        : await findAssignedBusinessIdsByUserId(session.profile.id);

    if (!canManageBusinessForProfile(session.profile, SINGLE_BUSINESS_ID, assignedIds)) {
      accessError = "この事業へのアクセス権限がありません。";
    } else {
      const [rawProducts, taxRate, counts] = await Promise.all([
        findProductsByBusinessId(SINGLE_BUSINESS_ID),
        getCurrentTaxRate(),
        findProductSalesCountsByBusinessId(SINGLE_BUSINESS_ID).catch(() => ({})),
      ]);
      products = rawProducts.filter((p) => p.status === "on_sale");
      taxRatePercent = taxRate?.rate_percent ?? 10;
      salesCounts = counts;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">レジ</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        商品を選択してカートに追加し、支払方法を選んで販売を確定してください。
      </p>

      {accessError && (
        <p className="mt-4 text-sm text-red-600">{accessError}</p>
      )}

      {!business && !accessError && (
        <p className="mt-4 text-sm text-muted">
          操作可能な事業がありません。
        </p>
      )}

      {business && !accessError && (
        <div className="mt-6">
          <p className="mb-4 text-sm text-muted">
            事業: <span className="font-medium text-foreground">{business.name}</span>
            <span className="ml-2 text-xs">消費税率: {taxRatePercent}%</span>
          </p>
          <PosTerminal
            action={createSaleSessionAction}
            products={products}
            businessId={SINGLE_BUSINESS_ID}
            taxRatePercent={taxRatePercent}
            salesCounts={salesCounts}
          />
        </div>
      )}
    </div>
  );
}

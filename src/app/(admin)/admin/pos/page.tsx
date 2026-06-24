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
import type { Product } from "@/types/database";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "レジ" };

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AdminPosPage({ searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/pos");

  const { businessId } = await searchParams;
  const isAdmin = isAdminRole(session.profile.role);

  const businesses = await findManageableBusinesses();

  if (!businessId && !isAdmin && businesses.length === 1 && businesses[0]) {
    redirect(`/admin/pos?businessId=${businesses[0].id}`);
  }

  let products: Product[] = [];
  let salesCounts: Record<string, number> = {};
  let accessError: string | null = null;
  let taxRatePercent = 10;

  if (businessId) {
    const isStaff = isStaffRole(session.profile.role);
    const assignedIds = isAdmin
      ? []
      : isStaff
        ? await findAssignedBusinessIdsByStaffUserId(session.profile.id)
        : await findAssignedBusinessIdsByUserId(session.profile.id);

    if (!canManageBusinessForProfile(session.profile, businessId, assignedIds)) {
      accessError = "この事業へのアクセス権限がありません。";
    } else {
      const [rawProducts, taxRate, counts] = await Promise.all([
        findProductsByBusinessId(businessId),
        getCurrentTaxRate(),
        findProductSalesCountsByBusinessId(businessId).catch(() => ({})),
      ]);
      products = rawProducts.filter((p) => p.status === "on_sale");
      taxRatePercent = taxRate?.rate_percent ?? 10;
      salesCounts = counts;
    }
  }

  const selectedBusiness = businesses.find((b) => b.id === businessId);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">レジ</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        商品を選択してカートに追加し、支払方法を選んで販売を確定してください。
      </p>

      {businesses.length > 1 && (
        <form method="get" action="/admin/pos" className="mt-4">
          <label htmlFor="businessId" className="block text-sm font-medium">
            事業を選択
          </label>
          <div className="mt-1 flex items-center gap-2">
            <select
              name="businessId"
              id="businessId"
              defaultValue={businessId ?? ""}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              <option value="">-- 事業を選択 --</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-slate-50"
            >
              表示
            </button>
          </div>
        </form>
      )}

      {accessError && (
        <p className="mt-4 text-sm text-red-600">{accessError}</p>
      )}

      {!businessId && !accessError && (
        <p className="mt-4 text-sm text-muted">
          {businesses.length === 0
            ? "操作可能な事業がありません。"
            : "事業を選択してレジを開始します。"}
        </p>
      )}

      {businessId && !accessError && (
        <div className="mt-6">
          {selectedBusiness && (
            <p className="mb-4 text-sm text-muted">
              事業:{" "}
              <span className="font-medium text-foreground">{selectedBusiness.name}</span>
              <span className="ml-2 text-xs">消費税率: {taxRatePercent}%</span>
            </p>
          )}
          <PosTerminal
            action={createSaleSessionAction}
            products={products}
            businessId={businessId}
            taxRatePercent={taxRatePercent}
            salesCounts={salesCounts}
          />
        </div>
      )}
    </div>
  );
}

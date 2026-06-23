import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ManualSaleForm } from "@/components/admin/ManualSaleForm";
import { createManualSaleAction } from "../actions";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import {
  findManageableBusinesses,
  findManageableSpots,
} from "@/lib/repositories/businesses.repository";
import { getCurrentTaxRate } from "@/lib/repositories/tax-rates.repository";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "手動売上 新規登録" };

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AdminManualSalesNewPage({ searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/manual-sales/new");

  const { businessId } = await searchParams;

  const [businesses, locations, taxRate] = await Promise.all([
    findManageableBusinesses(),
    findManageableSpots(),
    getCurrentTaxRate(),
  ]);

  const currentTaxRate = taxRate?.rate_percent ?? 10;
  const returnPath = businessId
    ? `/admin/manual-sales?businessId=${businessId}`
    : "/admin/manual-sales";

  return (
    <div>
      <Link href={returnPath} className="text-sm text-primary hover:underline">
        ← 手動売上管理
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-foreground">手動売上 新規登録</h2>

      <div className="mt-8">
        {businesses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-6 py-8 text-sm text-muted">
            操作可能な事業がありません。事業割当を確認してください。
          </p>
        ) : (
          <ManualSaleForm
            action={createManualSaleAction}
            businesses={businesses}
            locations={locations}
            currentTaxRate={currentTaxRate}
            defaultBusinessId={businessId}
            submitLabel="登録する"
          />
        )}
      </div>
    </div>
  );
}

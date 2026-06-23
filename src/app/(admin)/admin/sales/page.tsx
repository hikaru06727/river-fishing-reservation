import { redirect } from "next/navigation";
import { SalesDashboardView } from "@/components/admin/sales/SalesDashboardView";
import { getSalesDashboard } from "@/lib/services/sales.service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "売上ダッシュボード",
};

interface AdminSalesPageProps {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function AdminSalesPage({ searchParams }: AdminSalesPageProps) {
  const params = await searchParams;
  const result = await getSalesDashboard(params);

  if (!result) {
    redirect("/admin/login?next=/admin/sales");
  }

  return (
    <SalesDashboardView
      report={result.report}
      insights={result.insights}
      isAdmin={result.isAdmin}
      scopedBusinessNames={result.scopedBusinessNames}
      productSalesYen={result.productSalesYen}
    />
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import {
  findManageableBusinesses,
  findManageableSpots,
} from "@/lib/repositories/businesses.repository";
import { getManualSalesForBusiness } from "@/lib/services/manual-sales.service";
import { isAdminRole, isBusinessAdminRole } from "@/lib/auth/role";
import { SINGLE_BUSINESS_ID } from "@/lib/feature-flags";
import type { ManualSale } from "@/types/database";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "手動売上管理" };

const CATEGORY_LABELS: Record<string, string> = {
  bait: "餌",
  rental: "レンタル",
  parking: "駐車場",
  food: "飲食",
  event: "イベント",
  other: "その他",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "現金",
  card: "カード",
  qr: "QR",
  other: "その他",
};

export default async function AdminManualSalesPage() {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/login?next=/admin/manual-sales");

  if (!isAdminRole(session.profile.role) && !isBusinessAdminRole(session.profile.role)) {
    redirect("/admin");
  }

  const [businesses, locations] = await Promise.all([
    findManageableBusinesses(),
    findManageableSpots(),
  ]);
  const business = businesses[0];

  let sales: ManualSale[] | null = null;
  let salesError: string | null = null;

  if (business) {
    const result = await getManualSalesForBusiness(session.profile, SINGLE_BUSINESS_ID);
    if (result.ok) {
      sales = result.data;
    } else {
      salesError = result.error;
    }
  }

  const locationMap = Object.fromEntries(locations.map((l) => [l.id, l.name]));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">手動売上管理</h2>
        {business && (
          <Link
            href={`/admin/manual-sales/new?businessId=${SINGLE_BUSINESS_ID}`}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
          >
            + 新規登録
          </Link>
        )}
      </div>

      {salesError && <p className="mt-4 text-sm text-red-600">{salesError}</p>}

      {!business && (
        <p className="mt-4 text-sm text-muted">
          操作可能な事業がありません。
        </p>
      )}

      {business && sales !== null && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted">
            事業: <span className="font-medium text-foreground">{business.name}</span>
          </p>
          {sales.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted">
              手動売上が登録されていません。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium">売上日</th>
                    <th className="px-4 py-3 text-left font-medium">カテゴリ</th>
                    <th className="px-4 py-3 text-left font-medium">釣り場</th>
                    <th className="px-4 py-3 text-right font-medium">金額（税抜）</th>
                    <th className="px-4 py-3 text-center font-medium">税率</th>
                    <th className="px-4 py-3 text-left font-medium">支払方法</th>
                    <th className="px-4 py-3 text-left font-medium">備考</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{s.sale_date}</td>
                      <td className="px-4 py-3">
                        {CATEGORY_LABELS[s.category] ?? s.category}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {s.location_id ? (locationMap[s.location_id] ?? "-") : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        ¥{s.amount_yen.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">{s.tax_rate_percent}%</td>
                      <td className="px-4 py-3">
                        {PAYMENT_LABELS[s.payment_method] ?? s.payment_method}
                      </td>
                      <td className="px-4 py-3 text-muted">{s.description ?? "-"}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/manual-sales/${s.id}/edit`}
                          className="text-sm text-primary hover:underline"
                        >
                          編集
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

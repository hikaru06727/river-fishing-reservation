import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { isAdminRole } from "@/lib/auth/role";
import { listRefunds } from "@/lib/services/refund.service";
import { RefundListView } from "@/components/refund/RefundListView";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "返金一覧" };

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AdminRefundsPage({ searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/refunds");

  if (!hasPermission(session.profile.role, "REFUND_MANAGE")) {
    redirect("/admin");
  }

  const { businessId } = await searchParams;
  const isAdmin = isAdminRole(session.profile.role);

  const businesses = await findManageableBusinesses();

  if (!businessId && !isAdmin && businesses.length === 1 && businesses[0]) {
    redirect(`/admin/refunds?businessId=${businesses[0].id}`);
  }

  let refundsResult = null;
  if (businessId) {
    const result = await listRefunds(session.profile, { businessId });
    if (result.ok) refundsResult = result.data;
  }

  const selectedBusiness = businesses.find((b) => b.id === businessId);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">返金一覧</h2>

      {businesses.length > 1 && (
        <form method="get" action="/admin/refunds">
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

      {!businessId && (
        <p className="text-sm text-muted">
          {businesses.length === 0
            ? "操作可能な事業がありません。"
            : "事業を選択して返金一覧を表示します。"}
        </p>
      )}

      {businessId && (
        <>
          {selectedBusiness && (
            <p className="text-sm text-muted">
              事業:{" "}
              <span className="font-medium text-foreground">{selectedBusiness.name}</span>
            </p>
          )}

          {refundsResult === null ? (
            <p className="text-sm text-red-600">返金一覧の取得に失敗しました。</p>
          ) : refundsResult.data.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted">
              返金記録がありません。
            </p>
          ) : (
            <RefundListView refunds={refundsResult.data} />
          )}
        </>
      )}
    </div>
  );
}

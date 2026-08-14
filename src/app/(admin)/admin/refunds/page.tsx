import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { listRefunds, listUnresolvedFailedRefunds } from "@/lib/services/refund.service";
import { RefundListView } from "@/components/refund/RefundListView";
import { FailedRefundsPanel } from "@/components/refund/FailedRefundsPanel";
import { SINGLE_BUSINESS_ID } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "返金一覧" };

export default async function AdminRefundsPage() {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/login?next=/admin/refunds");

  if (!hasPermission(session.profile.role, "REFUND_MANAGE")) {
    redirect("/admin");
  }

  const businesses = await findManageableBusinesses();
  const business = businesses[0];

  let refundsResult = null;
  let failedRefunds = null;
  if (business) {
    const result = await listRefunds(session.profile, { businessId: SINGLE_BUSINESS_ID });
    if (result.ok) refundsResult = result.data;

    const failedResult = await listUnresolvedFailedRefunds(session.profile, {
      businessId: SINGLE_BUSINESS_ID,
    });
    if (failedResult.ok) failedRefunds = failedResult.data;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">返金一覧</h2>

      {!business && (
        <p className="text-sm text-muted">
          操作可能な事業がありません。
        </p>
      )}

      {business && (
        <>
          <p className="text-sm text-muted">
            事業: <span className="font-medium text-foreground">{business.name}</span>
          </p>

          {failedRefunds !== null && (
            <FailedRefundsPanel businessId={SINGLE_BUSINESS_ID} refunds={failedRefunds} />
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

import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { isAdminRole } from "@/lib/auth/role";
import { listRefunds } from "@/lib/services/refund.service";
import type { SaleRefundStatus } from "@/types/domain";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "返金一覧" };

const STATUS_LABELS: Record<SaleRefundStatus, string> = {
  pending: "処理中",
  completed: "完了",
  failed: "失敗",
};

const STATUS_STYLES: Record<SaleRefundStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "現金",
  card: "カード",
  other: "その他",
};

function formatJst(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium">返金日時</th>
                    <th className="px-4 py-3 text-left font-medium">対象</th>
                    <th className="px-4 py-3 text-right font-medium">金額</th>
                    <th className="px-4 py-3 text-left font-medium">方法</th>
                    <th className="px-4 py-3 text-left font-medium">理由</th>
                    <th className="px-4 py-3 text-center font-medium">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {refundsResult.data.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted">{formatJst(r.refunded_at)}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {r.sale_session_id
                          ? `POS売上`
                          : r.reservation_id
                          ? `予約`
                          : "-"}
                        <br />
                        <span className="font-mono text-[10px]">
                          {(r.sale_session_id ?? r.reservation_id ?? "").slice(0, 8)}...
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        ¥{Number(r.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {METHOD_LABELS[r.payment_method] ?? r.payment_method}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-muted">
                        {r.reason ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
                        >
                          {STATUS_LABELS[r.status]}
                        </span>
                        {r.note && (
                          <p className="mt-0.5 text-[10px] text-red-500">{r.note}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

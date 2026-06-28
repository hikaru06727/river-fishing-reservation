import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { hasPermission } from "@/lib/permissions";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { isAdminRole } from "@/lib/auth/role";
import {
  listClosings,
  getLastClosing,
  getPendingCorrectionCount,
} from "@/lib/services/register-closing.service";
import { RegisterCloseButton } from "@/components/register/RegisterCloseButton";
import { ClosingListView } from "@/components/register/ClosingListView";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "レジ締め" };

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AdminRegisterClosingPage({ searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/register-closing");

  if (!hasPermission(session.profile.role, "POS_CLOSE")) {
    redirect("/admin");
  }

  const { businessId } = await searchParams;
  const isAdmin = isAdminRole(session.profile.role);

  const businesses = await findManageableBusinesses();

  if (!businessId && !isAdmin && businesses.length === 1 && businesses[0]) {
    redirect(`/admin/register-closing?businessId=${businesses[0].id}`);
  }

  const canApprove = hasPermission(session.profile.role, "CLOSE_CORRECTION_APPROVE");

  const now = new Date();
  let lastClosedAt: string | null = null;
  let closingsResult = null;
  let pendingCount = 0;

  if (businessId) {
    const [lastResult, listResult] = await Promise.all([
      getLastClosing(session.profile, businessId).catch(() => null),
      listClosings(session.profile, { businessId }).catch(() => null),
    ]);

    if (lastResult?.ok) {
      lastClosedAt = lastResult.data?.closed_at ?? null;
    }
    closingsResult = listResult?.ok ? listResult.data : null;

    if (canApprove) {
      pendingCount = await getPendingCorrectionCount(session.profile, businessId).catch(() => 0);
    }
  }

  const periodStart = lastClosedAt ?? new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const periodEnd = now.toISOString();

  const selectedBusiness = businesses.find((b) => b.id === businessId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">レジ締め</h2>
      </div>

      {businesses.length > 1 && (
        <form method="get" action="/admin/register-closing">
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
            : "事業を選択してレジ締めを行います。"}
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

          <div className="rounded-xl border border-border p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">レジを締める</h3>
            <div className="mb-4 space-y-1 text-sm text-muted">
              <p>
                <span className="font-medium text-foreground">開始: </span>
                {new Date(periodStart).toLocaleString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {!lastClosedAt && " （前回の締めなし・24時間前を起点）"}
              </p>
              <p>
                <span className="font-medium text-foreground">終了: </span>
                {now.toLocaleString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                （現在）
              </p>
            </div>
            <RegisterCloseButton
              businessId={businessId}
              periodStart={periodStart}
              periodEnd={periodEnd}
            />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">締め記録一覧</h3>
            {closingsResult ? (
              <ClosingListView
                closings={closingsResult.data}
                businessId={businessId}
                canApprove={canApprove}
                pendingCorrectionCount={pendingCount}
              />
            ) : (
              <p className="text-sm text-red-600">締め記録の取得に失敗しました。</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses } from "@/lib/repositories/businesses.repository";
import { getBoothsByBusiness } from "@/lib/services/booth.service";
import { hasPermission } from "@/lib/permissions";
import { isAdminRole } from "@/lib/auth/role";
import type { BoothRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "ブース管理" };

const STATUS_LABEL: Record<string, string> = {
  active: "公開中",
  inactive: "非公開",
};

const STATUS_STYLE: Record<string, string> = {
  active: "text-green-700 bg-green-50 border-green-200",
  inactive: "text-slate-500 bg-slate-50 border-slate-200",
};

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AdminBoothsPage({ searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/booths");

  if (!hasPermission(session.profile.role, "BOOTH_MANAGE")) {
    redirect("/admin");
  }

  const { businessId } = await searchParams;
  const isAdmin = isAdminRole(session.profile.role);
  const businesses = await findManageableBusinesses();

  if (!businessId && !isAdmin && businesses.length === 1 && businesses[0]) {
    redirect(`/admin/booths?businessId=${businesses[0].id}`);
  }

  let booths: BoothRow[] | null = null;
  let boothsError: string | null = null;

  if (businessId) {
    const result = await getBoothsByBusiness(session.profile, businessId);
    if (result.ok) booths = result.data;
    else boothsError = result.error;
  }

  const selectedBusiness = businesses.find((b) => b.id === businessId);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">ブース管理</h2>
        {businessId && (
          <Link
            href={`/admin/booths/new?businessId=${businessId}`}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
          >
            + ブース追加
          </Link>
        )}
      </div>

      {businesses.length > 1 && (
        <form method="get" action="/admin/booths" className="mt-4">
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

      {boothsError && <p className="mt-4 text-sm text-red-600">{boothsError}</p>}

      {!businessId && (
        <p className="mt-4 text-sm text-muted">
          {businesses.length === 0
            ? "操作可能な事業がありません。"
            : "事業を選択してブースを表示します。"}
        </p>
      )}

      {businessId && booths !== null && (
        <div className="mt-4">
          {selectedBusiness && (
            <p className="mb-2 text-sm text-muted">
              事業:{" "}
              <span className="font-medium text-foreground">{selectedBusiness.name}</span>
            </p>
          )}
          {booths.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted">
              ブースが登録されていません。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium">ブース名</th>
                    <th className="px-4 py-3 text-right font-medium">税抜き価格</th>
                    <th className="px-4 py-3 text-center font-medium">収容</th>
                    <th className="px-4 py-3 text-center font-medium">ステータス</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {booths.map((booth) => (
                    <tr key={booth.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{booth.name}</div>
                        {booth.description && (
                          <div className="mt-0.5 text-xs text-muted line-clamp-1">
                            {booth.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        ¥{booth.price.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">{booth.capacity}名</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[booth.status] ?? ""}`}
                        >
                          {STATUS_LABEL[booth.status] ?? booth.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/booths/${booth.id}?businessId=${businessId}`}
                          className="text-sm text-muted hover:underline"
                        >
                          詳細
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

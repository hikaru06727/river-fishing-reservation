import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses, findManageableSpots } from "@/lib/repositories/businesses.repository";
import { hasPermission } from "@/lib/permissions";
import { createBoothAction } from "../actions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = { title: "ブース新規作成" };

interface PageProps {
  searchParams: Promise<{ businessId?: string; error?: string }>;
}

export default async function AdminBoothsNewPage({ searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login?next=/admin/booths/new");

  if (!hasPermission(session.profile.role, "BOOTH_MANAGE")) {
    redirect("/admin");
  }

  const { businessId, error } = await searchParams;

  const [businesses, locations] = await Promise.all([
    findManageableBusinesses(),
    findManageableSpots(),
  ]);

  const returnPath = businessId
    ? `/admin/booths?businessId=${businessId}`
    : "/admin/booths";

  return (
    <div>
      <Link href={returnPath} className="text-sm text-primary hover:underline">
        ← ブース管理
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-foreground">ブース新規作成</h2>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={createBoothAction} className="mt-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium">
            事業 <span className="text-red-500">*</span>
          </label>
          <select
            name="business_id"
            defaultValue={businessId ?? ""}
            required
            className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
          >
            <option value="">-- 事業を選択 --</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">
            ブース名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder="例: A区画"
            className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">説明</label>
          <textarea
            name="description"
            rows={3}
            placeholder="ブースの説明（任意）"
            className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">
              税抜き価格（円）<span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="price"
              defaultValue={0}
              min={0}
              required
              className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">収容人数</label>
            <input
              type="number"
              name="capacity"
              defaultValue={1}
              min={1}
              className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">税区分</label>
          <select
            name="tax_category"
            defaultValue="standard"
            className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
          >
            <option value="standard">標準税率（10%）</option>
            <option value="reduced">軽減税率（8%）</option>
          </select>
        </div>

        {locations.length > 0 && (
          <div>
            <label className="block text-sm font-medium">場所（任意）</label>
            <select
              name="location_id"
              className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
            >
              <option value="">-- 場所を選択 --</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-2 text-sm text-white hover:bg-primary/90"
          >
            作成する
          </button>
          <Link
            href={returnPath}
            className="rounded-lg border border-border px-5 py-2 text-sm hover:bg-slate-50"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}

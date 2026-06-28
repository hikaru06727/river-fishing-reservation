import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { getBoothById, getSlotsByBooth } from "@/lib/services/booth.service";
import { hasPermission } from "@/lib/permissions";
import { generateSlotsAction } from "../../actions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const SLOT_STATUS_LABEL: Record<string, string> = {
  open: "受付中",
  full: "満席",
  closed: "クローズ",
};

const SLOT_STATUS_STYLE: Record<string, string> = {
  open: "text-green-700 bg-green-50 border-green-200",
  full: "text-red-700 bg-red-50 border-red-200",
  closed: "text-slate-500 bg-slate-50 border-slate-200",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    businessId?: string;
    date?: string;
    success?: string;
    generated?: string;
    error?: string;
  }>;
}

export default async function AdminBoothSlotsPage({ params, searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login");

  if (!hasPermission(session.profile.role, "BOOTH_MANAGE")) {
    redirect("/admin");
  }

  const { id: boothId } = await params;
  const { businessId, date, success, generated, error } = await searchParams;

  if (!businessId) redirect("/admin/booths");

  const boothResult = await getBoothById(session.profile, boothId, businessId);
  if (!boothResult.ok) redirect(`/admin/booths?businessId=${businessId}`);
  const booth = boothResult.data;

  const today = new Date().toISOString().slice(0, 10);
  const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const slotsResult = await getSlotsByBooth(session.profile, boothId, businessId, {
    from: today,
    to: threeMonthsLater,
  });
  const slots = slotsResult.ok ? slotsResult.data : [];

  const returnPath = `/admin/booths/${boothId}?businessId=${businessId}`;

  return (
    <div>
      <Link href={returnPath} className="text-sm text-primary hover:underline">
        ← {booth.name}
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-foreground">{booth.name} — 枠管理</h2>

      {success && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {generated}件の枠を生成しました。
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* 一括生成フォーム */}
      <div className="mt-6 max-w-lg rounded-xl border border-border p-4">
        <h3 className="text-sm font-medium">枠を一括生成</h3>
        <form action={generateSlotsAction} className="mt-4 space-y-4">
          <input type="hidden" name="business_id" value={businessId} />
          <input type="hidden" name="booth_id" value={boothId} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium">開始日 <span className="text-red-500">*</span></label>
              <input
                type="date"
                name="from_date"
                defaultValue={date ?? today}
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">終了日 <span className="text-red-500">*</span></label>
              <input
                type="date"
                name="to_date"
                defaultValue={date ?? today}
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium">開始時刻 <span className="text-red-500">*</span></label>
              <input
                type="time"
                name="start_time"
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">終了時刻 <span className="text-red-500">*</span></label>
              <input
                type="time"
                name="end_time"
                required
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium">受付上限（枠あたり）</label>
            <input
              type="number"
              name="max_bookings"
              defaultValue={1}
              min={1}
              className="mt-1 w-32 rounded-xl border border-border px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-2 text-sm text-white hover:bg-primary/90"
          >
            生成する
          </button>
        </form>
      </div>

      {/* 枠一覧 */}
      <div className="mt-8">
        <h3 className="text-sm font-medium">今後90日間の枠（{slots.length}件）</h3>
        {slots.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            枠がありません。上のフォームから生成してください。
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium">日付</th>
                  <th className="px-4 py-3 text-left font-medium">時間帯</th>
                  <th className="px-4 py-3 text-center font-medium">受付上限</th>
                  <th className="px-4 py-3 text-center font-medium">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{slot.date}</td>
                    <td className="px-4 py-3">
                      {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3 text-center">{slot.max_bookings}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs ${SLOT_STATUS_STYLE[slot.status] ?? ""}`}
                      >
                        {SLOT_STATUS_LABEL[slot.status] ?? slot.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

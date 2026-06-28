import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import { findManageableBusinesses, findManageableSpots } from "@/lib/repositories/businesses.repository";
import {
  getBoothById,
  getSlotsByBooth,
  getBookingsBySlot,
} from "@/lib/services/booth.service";
import { hasPermission } from "@/lib/permissions";
import { BoothCalendarSection } from "@/components/admin/booths/BoothCalendarSection";
import { updateBoothAction } from "../actions";
import type { SlotSummary } from "@/components/ui/calendar";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ businessId?: string; date?: string; success?: string; error?: string }>;
}

export default async function AdminBoothDetailPage({ params, searchParams }: PageProps) {
  const session = await getAuthenticatedManagement();
  if (!session) redirect("/admin/login");

  if (!hasPermission(session.profile.role, "BOOTH_MANAGE")) {
    redirect("/admin");
  }

  const { id: boothId } = await params;
  const { businessId, date, success, error } = await searchParams;

  if (!businessId) redirect("/admin/booths");

  const [boothResult, businesses, locations] = await Promise.all([
    getBoothById(session.profile, boothId, businessId),
    findManageableBusinesses(),
    findManageableSpots(),
  ]);

  if (!boothResult.ok) redirect("/admin/booths");
  const booth = boothResult.data;

  // 3ヶ月分の枠を取得
  const today = new Date().toISOString().slice(0, 10);
  const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const slotsResult = await getSlotsByBooth(session.profile, boothId, businessId, {
    from: today,
    to: threeMonthsLater,
  });
  const slots = slotsResult.ok ? slotsResult.data : [];

  // 各枠の予約数を取得して SlotSummary に変換
  const slotSummaries: SlotSummary[] = await Promise.all(
    slots.map(async (slot) => {
      const bookingsResult = await getBookingsBySlot(session.profile, slot.id, businessId);
      const bookings = bookingsResult.ok ? bookingsResult.data : [];
      return {
        id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        max_bookings: slot.max_bookings,
        booking_count: bookings.length,
        status: slot.status,
      };
    }),
  );

  // 日付別にグループ化
  const slotsByDate: Record<string, SlotSummary[]> = {};
  for (const summary of slotSummaries) {
    const slotDate = slots.find((s) => s.id === summary.id)?.date;
    if (!slotDate) continue;
    if (!slotsByDate[slotDate]) slotsByDate[slotDate] = [];
    slotsByDate[slotDate]!.push(summary);
  }

  const returnPath = `/admin/booths?businessId=${businessId}`;
  const selectedBusiness = businesses.find((b) => b.id === businessId);

  return (
    <div>
      <Link href={returnPath} className="text-sm text-primary hover:underline">
        ← ブース管理
      </Link>
      <h2 className="mt-4 text-lg font-semibold text-foreground">{booth.name}</h2>
      {selectedBusiness && (
        <p className="text-sm text-muted">事業: {selectedBusiness.name}</p>
      )}

      {success && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          ブース情報を更新しました。
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* 編集フォーム */}
      <form action={updateBoothAction} className="mt-6 max-w-lg space-y-4">
        <input type="hidden" name="booth_id" value={booth.id} />
        <input type="hidden" name="business_id" value={businessId} />

        <div>
          <label className="block text-sm font-medium">
            ブース名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            defaultValue={booth.name}
            required
            className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">説明</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={booth.description ?? ""}
            className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">税抜き価格（円）</label>
            <input
              type="number"
              name="price"
              defaultValue={booth.price}
              min={0}
              className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">収容人数</label>
            <input
              type="number"
              name="capacity"
              defaultValue={booth.capacity}
              min={1}
              className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">税区分</label>
            <select
              name="tax_category"
              defaultValue={booth.tax_category}
              className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
            >
              <option value="standard">標準税率（10%）</option>
              <option value="reduced">軽減税率（8%）</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">ステータス</label>
            <select
              name="status"
              defaultValue={booth.status}
              className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
            >
              <option value="active">公開中</option>
              <option value="inactive">非公開</option>
            </select>
          </div>
        </div>

        {locations.length > 0 && (
          <div>
            <label className="block text-sm font-medium">場所（任意）</label>
            <select
              name="location_id"
              defaultValue={booth.location_id ?? ""}
              className="mt-1 w-full rounded-xl border border-border px-4 py-2 text-sm"
            >
              <option value="">-- 未設定 --</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-2 text-sm text-white hover:bg-primary/90"
          >
            保存する
          </button>
        </div>
      </form>

      {/* カレンダー + 枠一覧 */}
      <BoothCalendarSection
        businessId={businessId}
        boothId={boothId}
        slotsByDate={slotsByDate}
        initialDate={date ?? today}
      />
    </div>
  );
}

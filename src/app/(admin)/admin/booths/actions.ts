"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedManagement } from "@/lib/auth/get-user";
import {
  createBooth,
  updateBoothById,
  generateBoothSlots,
} from "@/lib/services/booth.service";
import { hasPermission } from "@/lib/permissions";

export async function createBoothAction(formData: FormData): Promise<void> {
  const session = await getAuthenticatedManagement();
  if (!session || !hasPermission(session.profile.role, "BOOTH_MANAGE")) {
    redirect("/admin");
  }

  const businessId = formData.get("business_id") as string;
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const capacity = parseInt(formData.get("capacity") as string, 10) || 1;
  const price = parseInt(formData.get("price") as string, 10) || 0;
  const taxCategory = (formData.get("tax_category") as "standard" | "reduced") ?? "standard";
  const locationId = (formData.get("location_id") as string | null)?.trim() || null;

  if (!name) redirect(`/admin/booths/new?businessId=${businessId}&error=名前を入力してください`);

  const result = await createBooth(session.profile, {
    business_id: businessId,
    name,
    description,
    capacity,
    price,
    tax_category: taxCategory,
    location_id: locationId,
  });

  if (!result.ok) {
    redirect(`/admin/booths/new?businessId=${businessId}&error=${encodeURIComponent(result.error)}`);
  }

  redirect(`/admin/booths/${result.data.id}?businessId=${businessId}`);
}

export async function updateBoothAction(formData: FormData): Promise<void> {
  const session = await getAuthenticatedManagement();
  if (!session || !hasPermission(session.profile.role, "BOOTH_MANAGE")) {
    redirect("/admin");
  }

  const boothId = formData.get("booth_id") as string;
  const businessId = formData.get("business_id") as string;
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const capacity = parseInt(formData.get("capacity") as string, 10) || 1;
  const price = parseInt(formData.get("price") as string, 10) || 0;
  const taxCategory = (formData.get("tax_category") as "standard" | "reduced") ?? "standard";
  const status = (formData.get("status") as "active" | "inactive") ?? "active";
  const locationId = (formData.get("location_id") as string | null)?.trim() || null;

  const result = await updateBoothById(session.profile, boothId, businessId, {
    name,
    description,
    capacity,
    price,
    tax_category: taxCategory,
    status,
    location_id: locationId,
  });

  if (!result.ok) {
    redirect(`/admin/booths/${boothId}?businessId=${businessId}&error=${encodeURIComponent(result.error)}`);
  }

  redirect(`/admin/booths/${boothId}?businessId=${businessId}&success=1`);
}

export async function generateSlotsAction(formData: FormData): Promise<void> {
  const session = await getAuthenticatedManagement();
  if (!session || !hasPermission(session.profile.role, "BOOTH_MANAGE")) {
    redirect("/admin");
  }

  const businessId = formData.get("business_id") as string;
  const boothId = formData.get("booth_id") as string;
  const fromDate = formData.get("from_date") as string;
  const toDate = formData.get("to_date") as string;
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;
  const maxBookings = parseInt(formData.get("max_bookings") as string, 10) || 1;

  if (!fromDate || !toDate || !startTime || !endTime) {
    redirect(`/admin/booths/${boothId}/slots?businessId=${businessId}&error=すべての項目を入力してください`);
  }

  // fromDate〜toDate の日付リストを生成
  const dates: string[] = [];
  let current = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  if (dates.length === 0 || dates.length > 90) {
    redirect(`/admin/booths/${boothId}/slots?businessId=${businessId}&error=日付範囲は1日以上90日以内で指定してください`);
  }

  const result = await generateBoothSlots(session.profile, {
    business_id: businessId,
    booth_id: boothId,
    dates,
    start_time: startTime,
    end_time: endTime,
    max_bookings: maxBookings,
  });

  if (!result.ok) {
    redirect(`/admin/booths/${boothId}/slots?businessId=${businessId}&error=${encodeURIComponent(result.error)}`);
  }

  redirect(`/admin/booths/${boothId}/slots?businessId=${businessId}&success=1&generated=${result.data.length}`);
}

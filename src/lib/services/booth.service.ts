import { revalidatePath } from "next/cache";
import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import {
  findBoothsByBusinessId,
  findBoothById,
  insertBooth,
  updateBooth,
  type InsertBoothInput,
  type UpdateBoothInput,
} from "@/lib/repositories/booths.repository";
import {
  findSlotsByBoothId,
  findSlotsByBusinessAndDate,
  findSlotById,
  insertBoothSlots,
  updateBoothSlotStatus,
  countBookingsForSlot,
  type DateRange,
  type InsertBoothSlotInput,
} from "@/lib/repositories/booth-slots.repository";
import {
  findBookingsBySlotId,
  findBookingsByBusinessId,
  findBookingById,
  insertBoothBooking,
  updateBoothBookingPaymentStatus,
  type InsertBoothBookingInput,
  type BookingFilters,
} from "@/lib/repositories/booth-bookings.repository";
import { recordPaymentLedger } from "@/lib/services/payment-ledger.service";
import { canManageBusinessForProfile } from "@/lib/auth/management-access";
import { isAdminRole, isBusinessAdminRole, isStaffRole } from "@/lib/auth/role";
import type { BoothBookingRow, BoothRow, BoothSlotRow, Profile } from "@/types/database";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

type AuthProfile = Pick<Profile, "id" | "role">;

async function assertCanManageBusiness(
  profile: AuthProfile,
  businessId: string,
): Promise<ServiceResult<null>> {
  const assignedIds = isAdminRole(profile.role)
    ? []
    : await findAssignedBusinessIdsByUserId(profile.id);
  if (!canManageBusinessForProfile(profile, businessId, assignedIds)) {
    return { ok: false, error: "この事業への操作権限がありません。", status: 403 };
  }
  return { ok: true, data: null };
}

function requireAdminOrBusinessAdmin(profile: AuthProfile): ServiceResult<null> {
  if (!isAdminRole(profile.role) && !isBusinessAdminRole(profile.role)) {
    return { ok: false, error: "この操作にはbusiness_admin以上の権限が必要です。", status: 403 };
  }
  return { ok: true, data: null };
}

// ── Booth CRUD ──

export async function getBoothsByBusiness(
  profile: AuthProfile,
  businessId: string,
): Promise<ServiceResult<BoothRow[]>> {
  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const booths = await findBoothsByBusinessId(businessId);
    return { ok: true, data: booths };
  } catch {
    return { ok: false, error: "ブース一覧の取得に失敗しました。", status: 500 };
  }
}

export async function getBoothById(
  profile: AuthProfile,
  id: string,
  businessId: string,
): Promise<ServiceResult<BoothRow>> {
  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const booth = await findBoothById(id, businessId);
    if (!booth) return { ok: false, error: "ブースが見つかりません。", status: 404 };
    return { ok: true, data: booth };
  } catch {
    return { ok: false, error: "ブースの取得に失敗しました。", status: 500 };
  }
}

export async function createBooth(
  profile: AuthProfile,
  input: InsertBoothInput,
): Promise<ServiceResult<BoothRow>> {
  const perm = requireAdminOrBusinessAdmin(profile);
  if (!perm.ok) return perm;

  const auth = await assertCanManageBusiness(profile, input.business_id);
  if (!auth.ok) return auth;

  try {
    const booth = await insertBooth(input);
    revalidatePath("/admin/booths");
    return { ok: true, data: booth };
  } catch {
    return { ok: false, error: "ブースの作成に失敗しました。", status: 500 };
  }
}

export async function updateBoothById(
  profile: AuthProfile,
  id: string,
  businessId: string,
  input: UpdateBoothInput,
): Promise<ServiceResult<BoothRow>> {
  const perm = requireAdminOrBusinessAdmin(profile);
  if (!perm.ok) return perm;

  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const existing = await findBoothById(id, businessId);
    if (!existing) return { ok: false, error: "ブースが見つかりません。", status: 404 };

    const updated = await updateBooth(id, input);
    revalidatePath("/admin/booths");
    revalidatePath(`/admin/booths/${id}`);
    return { ok: true, data: updated };
  } catch {
    return { ok: false, error: "ブースの更新に失敗しました。", status: 500 };
  }
}

// ── BoothSlot ──

export async function getSlotsByBooth(
  profile: AuthProfile,
  boothId: string,
  businessId: string,
  dateRange?: DateRange,
): Promise<ServiceResult<BoothSlotRow[]>> {
  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const slots = await findSlotsByBoothId(boothId, dateRange);
    return { ok: true, data: slots };
  } catch {
    return { ok: false, error: "枠一覧の取得に失敗しました。", status: 500 };
  }
}

export async function getSlotsByDate(
  profile: AuthProfile,
  businessId: string,
  date: string,
): Promise<ServiceResult<BoothSlotRow[]>> {
  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const slots = await findSlotsByBusinessAndDate(businessId, date);
    return { ok: true, data: slots };
  } catch {
    return { ok: false, error: "枠一覧の取得に失敗しました。", status: 500 };
  }
}

export type GenerateSlotsInput = {
  business_id: string;
  booth_id: string;
  dates: string[];
  start_time: string;
  end_time: string;
  max_bookings?: number;
};

export async function generateBoothSlots(
  profile: AuthProfile,
  input: GenerateSlotsInput,
): Promise<ServiceResult<BoothSlotRow[]>> {
  const perm = requireAdminOrBusinessAdmin(profile);
  if (!perm.ok) return perm;

  const auth = await assertCanManageBusiness(profile, input.business_id);
  if (!auth.ok) return auth;

  const slotInputs: InsertBoothSlotInput[] = input.dates.map((date) => ({
    business_id: input.business_id,
    booth_id: input.booth_id,
    date,
    start_time: input.start_time,
    end_time: input.end_time,
    max_bookings: input.max_bookings ?? 1,
    status: "open" as const,
  }));

  try {
    const slots = await insertBoothSlots(slotInputs);
    revalidatePath(`/admin/booths/${input.booth_id}`);
    return { ok: true, data: slots };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, error: "指定した日付・時間帯の枠がすでに存在します。", status: 409 };
    }
    return { ok: false, error: "枠の生成に失敗しました。", status: 500 };
  }
}

// ── BoothBooking ──

export async function getBookingsBySlot(
  profile: AuthProfile,
  slotId: string,
  businessId: string,
): Promise<ServiceResult<BoothBookingRow[]>> {
  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const bookings = await findBookingsBySlotId(slotId);
    return { ok: true, data: bookings };
  } catch {
    return { ok: false, error: "予約一覧の取得に失敗しました。", status: 500 };
  }
}

export async function getBookingsByBusiness(
  profile: AuthProfile,
  businessId: string,
  filters?: BookingFilters,
): Promise<ServiceResult<BoothBookingRow[]>> {
  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const bookings = await findBookingsByBusinessId(businessId, filters);
    return { ok: true, data: bookings };
  } catch {
    return { ok: false, error: "予約一覧の取得に失敗しました。", status: 500 };
  }
}

export type CreateBoothBookingInput = Omit<InsertBoothBookingInput, "business_id"> & {
  business_id: string;
  payment_method: "cash" | "card" | "other";
};

export async function createBoothBooking(
  profile: AuthProfile,
  input: CreateBoothBookingInput,
): Promise<ServiceResult<BoothBookingRow>> {
  if (!isAdminRole(profile.role) && !isBusinessAdminRole(profile.role) && !isStaffRole(profile.role)) {
    return { ok: false, error: "この操作には権限が必要です。", status: 403 };
  }

  const auth = await assertCanManageBusiness(profile, input.business_id);
  if (!auth.ok) return auth;

  let slot: BoothSlotRow | null;
  try {
    slot = await findSlotById(input.booth_slot_id);
  } catch {
    return { ok: false, error: "枠の取得に失敗しました。", status: 500 };
  }

  if (!slot) return { ok: false, error: "指定した枠が見つかりません。", status: 404 };
  if (slot.status === "closed") return { ok: false, error: "この枠はクローズされています。", status: 409 };
  if (slot.status === "full") return { ok: false, error: "この枠は満席です。", status: 409 };

  let booking: BoothBookingRow;
  try {
    booking = await insertBoothBooking({
      business_id: input.business_id,
      booth_slot_id: input.booth_slot_id,
      customer_name: input.customer_name,
      customer_email: input.customer_email,
      customer_phone: input.customer_phone,
      quantity: input.quantity,
      unit_price: input.unit_price,
      tax_rate: input.tax_rate,
      total_amount: input.total_amount,
      payment_status: input.payment_status ?? "paid",
      source: input.source ?? "pos",
      notes: input.notes,
    });
  } catch {
    return { ok: false, error: "予約の作成に失敗しました。", status: 500 };
  }

  // booking数が max_bookings に達したら 'full' に更新
  try {
    const count = await countBookingsForSlot(slot.id);
    if (count >= slot.max_bookings) {
      await updateBoothSlotStatus(slot.id, "full");
    }
  } catch (e) {
    console.error("[createBoothBooking] slot status update failed:", e);
  }

  // payment_ledger に記録
  try {
    await recordPaymentLedger({
      business_id: input.business_id,
      source_type: "booth",
      source_id: booking.id,
      amount: booking.total_amount,
      payment_method: input.payment_method,
      status: "succeeded",
      paid_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[createBoothBooking] payment_ledger write failed:", e);
  }

  revalidatePath("/admin/booths");
  return { ok: true, data: booking };
}

export async function updateBookingPaymentStatus(
  profile: AuthProfile,
  id: string,
  businessId: string,
  paymentStatus: BoothBookingRow["payment_status"],
): Promise<ServiceResult<BoothBookingRow>> {
  const perm = requireAdminOrBusinessAdmin(profile);
  if (!perm.ok) return perm;

  const auth = await assertCanManageBusiness(profile, businessId);
  if (!auth.ok) return auth;

  try {
    const existing = await findBookingById(id);
    if (!existing) return { ok: false, error: "予約が見つかりません。", status: 404 };

    const updated = await updateBoothBookingPaymentStatus(id, paymentStatus);
    revalidatePath("/admin/booths");
    return { ok: true, data: updated };
  } catch {
    return { ok: false, error: "支払いステータスの更新に失敗しました。", status: 500 };
  }
}

export {
  findSlotsByBoothId,
  findSlotsByBusinessAndDate,
  findBookingsBySlotId,
  findBookingsByBusinessId,
};

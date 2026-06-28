import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: vi.fn(),
}));

vi.mock("@/lib/repositories/booths.repository", () => ({
  findBoothsByBusinessId: vi.fn(),
  findBoothById: vi.fn(),
  insertBooth: vi.fn(),
  updateBooth: vi.fn(),
}));

vi.mock("@/lib/repositories/booth-slots.repository", () => ({
  findSlotsByBoothId: vi.fn(),
  findSlotsByBusinessAndDate: vi.fn(),
  findSlotById: vi.fn(),
  insertBoothSlots: vi.fn(),
  updateBoothSlotStatus: vi.fn(),
  countBookingsForSlot: vi.fn(),
}));

vi.mock("@/lib/repositories/booth-bookings.repository", () => ({
  findBookingsBySlotId: vi.fn(),
  findBookingsByBusinessId: vi.fn(),
  findBookingById: vi.fn(),
  insertBoothBooking: vi.fn(),
  updateBoothBookingPaymentStatus: vi.fn(),
}));

vi.mock("@/lib/services/payment-ledger.service", () => ({
  recordPaymentLedger: vi.fn().mockResolvedValue({}),
}));

import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import {
  findBoothsByBusinessId,
  findBoothById,
  insertBooth,
  updateBooth,
} from "@/lib/repositories/booths.repository";
import {
  findSlotsByBoothId,
  findSlotById,
  insertBoothSlots,
  updateBoothSlotStatus,
  countBookingsForSlot,
} from "@/lib/repositories/booth-slots.repository";
import {
  insertBoothBooking,
} from "@/lib/repositories/booth-bookings.repository";
import { recordPaymentLedger } from "@/lib/services/payment-ledger.service";
import {
  getBoothsByBusiness,
  getBoothById,
  createBooth,
  updateBoothById,
  getSlotsByBooth,
  generateBoothSlots,
  createBoothBooking,
} from "./booth.service";

const bizId = "11111111-1111-4111-8111-111111111111";
const boothId = "booth-1111-1111-1111-111111111111";
const slotId = "slot-1111-1111-1111-111111111111";
const bookingId = "booking-111-1111-1111-111111111111";

const adminProfile = { id: "admin-id", role: "admin" as const };
const baProfile = { id: "ba-id", role: "business_admin" as const };
const staffProfile = { id: "staff-id", role: "staff" as const };
const userProfile = { id: "user-id", role: "user" as const };

const fakeBooth = {
  id: boothId,
  business_id: bizId,
  location_id: null,
  name: "テストブース",
  description: null,
  capacity: 1,
  price: 5000,
  tax_category: "standard" as const,
  status: "active" as const,
  created_at: "2026-06-29T00:00:00Z",
  updated_at: "2026-06-29T00:00:00Z",
};

const fakeSlot = {
  id: slotId,
  business_id: bizId,
  booth_id: boothId,
  date: "2026-07-01",
  start_time: "09:00:00",
  end_time: "12:00:00",
  max_bookings: 2,
  status: "open" as const,
  created_at: "2026-06-29T00:00:00Z",
  updated_at: "2026-06-29T00:00:00Z",
};

const fakeBooking = {
  id: bookingId,
  business_id: bizId,
  booth_slot_id: slotId,
  customer_name: "テスト太郎",
  customer_email: null,
  customer_phone: null,
  quantity: 1,
  unit_price: 5000,
  tax_rate: 10,
  total_amount: 5500,
  payment_status: "paid" as const,
  source: "pos" as const,
  notes: null,
  created_at: "2026-06-29T00:00:00Z",
  updated_at: "2026-06-29T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizId]);
});

// ── Booth CRUD ──

describe("getBoothsByBusiness", () => {
  it("admin: ブース一覧を返す", async () => {
    vi.mocked(findBoothsByBusinessId).mockResolvedValue([fakeBooth]);
    const result = await getBoothsByBusiness(adminProfile, bizId);
    expect(result).toEqual({ ok: true, data: [fakeBooth] });
  });

  it("business_admin: 自事業のブース一覧を返す", async () => {
    vi.mocked(findBoothsByBusinessId).mockResolvedValue([fakeBooth]);
    const result = await getBoothsByBusiness(baProfile, bizId);
    expect(result).toEqual({ ok: true, data: [fakeBooth] });
  });

  it("business_admin: 他事業はアクセス拒否", async () => {
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([]);
    const result = await getBoothsByBusiness(baProfile, bizId);
    expect(result).toEqual({ ok: false, error: expect.any(String), status: 403 });
  });
});

describe("getBoothById", () => {
  it("存在するブースを返す", async () => {
    vi.mocked(findBoothById).mockResolvedValue(fakeBooth);
    const result = await getBoothById(adminProfile, boothId, bizId);
    expect(result).toEqual({ ok: true, data: fakeBooth });
  });

  it("存在しないブースは 404", async () => {
    vi.mocked(findBoothById).mockResolvedValue(null);
    const result = await getBoothById(adminProfile, "no-such", bizId);
    expect(result).toEqual({ ok: false, error: expect.any(String), status: 404 });
  });
});

describe("createBooth", () => {
  it("business_admin: ブースを作成できる", async () => {
    vi.mocked(insertBooth).mockResolvedValue(fakeBooth);
    const result = await createBooth(baProfile, { business_id: bizId, name: "テストブース" });
    expect(result).toEqual({ ok: true, data: fakeBooth });
    expect(insertBooth).toHaveBeenCalledOnce();
  });

  it("staff: ブース作成は権限エラー", async () => {
    const result = await createBooth(staffProfile, { business_id: bizId, name: "テストブース" });
    expect(result).toEqual({ ok: false, error: expect.any(String), status: 403 });
    expect(insertBooth).not.toHaveBeenCalled();
  });

  it("user: ブース作成は権限エラー", async () => {
    const result = await createBooth(userProfile, { business_id: bizId, name: "テストブース" });
    expect(result).toEqual({ ok: false, error: expect.any(String), status: 403 });
  });
});

describe("updateBoothById", () => {
  it("admin: ブースを更新できる", async () => {
    vi.mocked(findBoothById).mockResolvedValue(fakeBooth);
    vi.mocked(updateBooth).mockResolvedValue({ ...fakeBooth, name: "更新後" });
    const result = await updateBoothById(adminProfile, boothId, bizId, { name: "更新後" });
    expect(result).toEqual({ ok: true, data: { ...fakeBooth, name: "更新後" } });
  });
});

// ── BoothSlot ──

describe("getSlotsByBooth", () => {
  it("枠一覧を返す", async () => {
    vi.mocked(findSlotsByBoothId).mockResolvedValue([fakeSlot]);
    const result = await getSlotsByBooth(adminProfile, boothId, bizId);
    expect(result).toEqual({ ok: true, data: [fakeSlot] });
  });
});

describe("generateBoothSlots", () => {
  it("business_admin: 枠を一括生成できる", async () => {
    vi.mocked(insertBoothSlots).mockResolvedValue([fakeSlot]);
    const result = await generateBoothSlots(baProfile, {
      business_id: bizId,
      booth_id: boothId,
      dates: ["2026-07-01"],
      start_time: "09:00:00",
      end_time: "12:00:00",
    });
    expect(result).toEqual({ ok: true, data: [fakeSlot] });
    expect(insertBoothSlots).toHaveBeenCalledOnce();
  });

  it("staff: 枠生成は権限エラー", async () => {
    const result = await generateBoothSlots(staffProfile, {
      business_id: bizId,
      booth_id: boothId,
      dates: ["2026-07-01"],
      start_time: "09:00:00",
      end_time: "12:00:00",
    });
    expect(result).toEqual({ ok: false, error: expect.any(String), status: 403 });
    expect(insertBoothSlots).not.toHaveBeenCalled();
  });

  it("重複エラー時は 409 を返す", async () => {
    vi.mocked(insertBoothSlots).mockRejectedValue(new Error("unique constraint violated"));
    const result = await generateBoothSlots(baProfile, {
      business_id: bizId,
      booth_id: boothId,
      dates: ["2026-07-01"],
      start_time: "09:00:00",
      end_time: "12:00:00",
    });
    expect(result).toEqual({ ok: false, error: expect.any(String), status: 409 });
  });
});

// ── BoothBooking ──

describe("createBoothBooking", () => {
  it("staff: 予約（POS販売）を作成できる", async () => {
    vi.mocked(findSlotById).mockResolvedValue(fakeSlot);
    vi.mocked(insertBoothBooking).mockResolvedValue(fakeBooking);
    vi.mocked(countBookingsForSlot).mockResolvedValue(1);
    vi.mocked(updateBoothSlotStatus).mockResolvedValue(fakeSlot);

    const result = await createBoothBooking(staffProfile, {
      business_id: bizId,
      booth_slot_id: slotId,
      customer_name: "テスト太郎",
      unit_price: 5000,
      tax_rate: 10,
      total_amount: 5500,
      payment_method: "cash",
    });
    expect(result).toEqual({ ok: true, data: fakeBooking });
    expect(insertBoothBooking).toHaveBeenCalledOnce();
    expect(recordPaymentLedger).toHaveBeenCalledWith(
      expect.objectContaining({ source_type: "booth", amount: 5500 }),
    );
  });

  it("枠が満席の場合は 409", async () => {
    vi.mocked(findSlotById).mockResolvedValue({ ...fakeSlot, status: "full" as const });
    const result = await createBoothBooking(staffProfile, {
      business_id: bizId,
      booth_slot_id: slotId,
      customer_name: "テスト太郎",
      unit_price: 5000,
      tax_rate: 10,
      total_amount: 5500,
      payment_method: "cash",
    });
    expect(result).toEqual({ ok: false, error: expect.any(String), status: 409 });
    expect(insertBoothBooking).not.toHaveBeenCalled();
  });

  it("枠がクローズの場合は 409", async () => {
    vi.mocked(findSlotById).mockResolvedValue({ ...fakeSlot, status: "closed" as const });
    const result = await createBoothBooking(staffProfile, {
      business_id: bizId,
      booth_slot_id: slotId,
      customer_name: "テスト太郎",
      unit_price: 5000,
      tax_rate: 10,
      total_amount: 5500,
      payment_method: "cash",
    });
    expect(result).toEqual({ ok: false, error: expect.any(String), status: 409 });
  });

  it("max_bookingsに達したら枠を 'full' に更新する", async () => {
    vi.mocked(findSlotById).mockResolvedValue({ ...fakeSlot, max_bookings: 1 });
    vi.mocked(insertBoothBooking).mockResolvedValue(fakeBooking);
    vi.mocked(countBookingsForSlot).mockResolvedValue(1); // 1件 >= max_bookings(1)
    vi.mocked(updateBoothSlotStatus).mockResolvedValue({ ...fakeSlot, status: "full" as const });

    await createBoothBooking(staffProfile, {
      business_id: bizId,
      booth_slot_id: slotId,
      customer_name: "テスト太郎",
      unit_price: 5000,
      tax_rate: 10,
      total_amount: 5500,
      payment_method: "cash",
    });

    expect(updateBoothSlotStatus).toHaveBeenCalledWith(slotId, "full");
  });

  it("user: 予約作成は権限エラー", async () => {
    const result = await createBoothBooking(userProfile, {
      business_id: bizId,
      booth_slot_id: slotId,
      customer_name: "テスト太郎",
      unit_price: 5000,
      tax_rate: 10,
      total_amount: 5500,
      payment_method: "cash",
    });
    expect(result).toEqual({ ok: false, error: expect.any(String), status: 403 });
  });
});

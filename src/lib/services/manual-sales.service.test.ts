import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: vi.fn(),
}));

vi.mock("@/lib/repositories/manual-sales.repository", () => ({
  findManualSalesByBusinessId: vi.fn(),
  findManualSaleById: vi.fn(),
  insertManualSale: vi.fn(),
  updateManualSale: vi.fn(),
  deleteManualSale: vi.fn(),
}));

import { findAssignedBusinessIdsByUserId } from "@/lib/repositories/businesses.repository";
import {
  deleteManualSale,
  findManualSaleById,
  findManualSalesByBusinessId,
  insertManualSale,
  updateManualSale,
} from "@/lib/repositories/manual-sales.repository";
import {
  createManualSale,
  deleteManualSaleById,
  getManualSalesForBusiness,
  updateManualSaleById,
} from "./manual-sales.service";

const bizA = "11111111-1111-4111-8111-111111111111";
const bizB = "22222222-2222-4222-8222-222222222222";
const saleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const adminProfile = { id: "admin-id", role: "admin" as const };
const baProfile = { id: "ba-id", role: "business_admin" as const };
const userProfile = { id: "user-id", role: "user" as const };

const fakeSale = {
  id: saleId,
  business_id: bizA,
  location_id: null,
  sale_date: "2026-06-01",
  amount_yen: 1000,
  tax_rate_percent: 10,
  category: "bait" as const,
  payment_method: "cash" as const,
  description: null,
  recorded_by: "ba-id",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

describe("getManualSalesForBusiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizA]);
    vi.mocked(findManualSalesByBusinessId).mockResolvedValue([fakeSale]);
  });

  it("admin は任意の事業の売上を取得できる", async () => {
    const result = await getManualSalesForBusiness(adminProfile, bizB);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([fakeSale]);
    expect(findManualSalesByBusinessId).toHaveBeenCalledWith(bizB, {});
  });

  it("business_admin は担当事業の売上を取得できる", async () => {
    const result = await getManualSalesForBusiness(baProfile, bizA);
    expect(result.ok).toBe(true);
    expect(findAssignedBusinessIdsByUserId).toHaveBeenCalledWith("ba-id");
  });

  it("business_admin は担当外事業の売上を取得できない", async () => {
    const result = await getManualSalesForBusiness(baProfile, bizB);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
    expect(findManualSalesByBusinessId).not.toHaveBeenCalled();
  });
});

const validCreateInput = {
  business_id: bizA,
  location_id: null,
  sale_date: "2026-06-01",
  amount_yen: 1000,
  tax_rate_percent: 10,
  category: "bait" as const,
  payment_method: "cash" as const,
  description: null,
};

describe("createManualSale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizA]);
    vi.mocked(insertManualSale).mockResolvedValue(fakeSale);
  });

  it("business_admin は担当事業に売上を登録できる", async () => {
    const result = await createManualSale(baProfile, validCreateInput);
    expect(result.ok).toBe(true);
    expect(insertManualSale).toHaveBeenCalledOnce();
    expect(insertManualSale).toHaveBeenCalledWith(
      expect.objectContaining({ recorded_by: "ba-id" }),
    );
  });

  it("business_admin は担当外事業に売上を登録できない", async () => {
    const result = await createManualSale(baProfile, { ...validCreateInput, business_id: bizB });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
    expect(insertManualSale).not.toHaveBeenCalled();
  });

  it("user ロールは売上を登録できない", async () => {
    const result = await createManualSale(userProfile, validCreateInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
    expect(insertManualSale).not.toHaveBeenCalled();
  });

  it("admin は任意の事業に売上を登録できる", async () => {
    const result = await createManualSale(adminProfile, { ...validCreateInput, business_id: bizB });
    expect(result.ok).toBe(true);
    expect(insertManualSale).toHaveBeenCalledOnce();
  });
});

describe("updateManualSaleById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizA]);
    vi.mocked(findManualSaleById).mockResolvedValue(fakeSale);
    vi.mocked(updateManualSale).mockResolvedValue({ ...fakeSale, amount_yen: 2000 });
  });

  it("business_admin は担当事業の売上を更新できる", async () => {
    const result = await updateManualSaleById(baProfile, saleId, { amount_yen: 2000 });
    expect(result.ok).toBe(true);
    expect(updateManualSale).toHaveBeenCalledWith(saleId, { amount_yen: 2000 });
  });

  it("担当外事業の売上は更新できない", async () => {
    vi.mocked(findManualSaleById).mockResolvedValue({ ...fakeSale, business_id: bizB });
    const result = await updateManualSaleById(baProfile, saleId, { amount_yen: 2000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
    expect(updateManualSale).not.toHaveBeenCalled();
  });

  it("存在しない売上は404を返す", async () => {
    vi.mocked(findManualSaleById).mockResolvedValue(null);
    const result = await updateManualSaleById(baProfile, saleId, { amount_yen: 2000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});

describe("deleteManualSaleById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findAssignedBusinessIdsByUserId).mockResolvedValue([bizA]);
    vi.mocked(findManualSaleById).mockResolvedValue(fakeSale);
    vi.mocked(deleteManualSale).mockResolvedValue(undefined);
  });

  it("business_admin は担当事業の売上を削除できる", async () => {
    const result = await deleteManualSaleById(baProfile, saleId);
    expect(result.ok).toBe(true);
    expect(deleteManualSale).toHaveBeenCalledWith(saleId);
  });

  it("担当外事業の売上は削除できない", async () => {
    vi.mocked(findManualSaleById).mockResolvedValue({ ...fakeSale, business_id: bizB });
    const result = await deleteManualSaleById(baProfile, saleId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
    expect(deleteManualSale).not.toHaveBeenCalled();
  });

  it("存在しない売上は404を返す", async () => {
    vi.mocked(findManualSaleById).mockResolvedValue(null);
    const result = await deleteManualSaleById(baProfile, saleId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});

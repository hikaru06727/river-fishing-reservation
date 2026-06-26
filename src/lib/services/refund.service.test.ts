import { beforeEach, describe, expect, it, vi } from "vitest";
import { refundCash, refundCard, listRefunds } from "@/lib/services/refund.service";

const {
  findAssignedBusinessIdsByUserIdMock,
  findAssignedBusinessIdsByStaffUserIdMock,
  insertSaleRefundMock,
  findRefundsByBusinessIdMock,
  findSaleSessionAmountByIdMock,
  findReservationAmountByIdMock,
  findTotalRefundedAmountMock,
  findStripePaymentIntentByReservationIdMock,
  stripeRefundsCreateMock,
} = vi.hoisted(() => ({
  findAssignedBusinessIdsByUserIdMock: vi.fn(),
  findAssignedBusinessIdsByStaffUserIdMock: vi.fn(),
  insertSaleRefundMock: vi.fn(),
  findRefundsByBusinessIdMock: vi.fn(),
  findSaleSessionAmountByIdMock: vi.fn(),
  findReservationAmountByIdMock: vi.fn(),
  findTotalRefundedAmountMock: vi.fn(),
  findStripePaymentIntentByReservationIdMock: vi.fn(),
  stripeRefundsCreateMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/repositories/businesses.repository", () => ({
  findAssignedBusinessIdsByUserId: findAssignedBusinessIdsByUserIdMock,
}));

vi.mock("@/lib/repositories/staff-members.repository", () => ({
  findAssignedBusinessIdsByStaffUserId: findAssignedBusinessIdsByStaffUserIdMock,
}));

vi.mock("@/lib/repositories/sale-refunds.repository", () => ({
  insertSaleRefund: insertSaleRefundMock,
  updateSaleRefundStatus: vi.fn(),
  findRefundsByBusinessId: findRefundsByBusinessIdMock,
  findStripePaymentIntentByReservationId: findStripePaymentIntentByReservationIdMock,
  findSaleSessionAmountById: findSaleSessionAmountByIdMock,
  findReservationAmountById: findReservationAmountByIdMock,
  findTotalRefundedAmount: findTotalRefundedAmountMock,
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({
    refunds: { create: stripeRefundsCreateMock },
  }),
}));

const BIZ_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "sess-1111-1111-1111-111111111111";
const RES_ID = "res-2222-2222-2222-222222222222";
const PROFILE_BA = { id: "ba-user-id", role: "business_admin" as const };
const PROFILE_STAFF = { id: "staff-user-id", role: "staff" as const };
const PROFILE_OTHER_BA = { id: "other-ba-id", role: "business_admin" as const };
const PROFILE_USER = { id: "user-id", role: "user" as const };

const SAMPLE_REFUND = {
  id: "refund-1",
  business_id: BIZ_A,
  sale_session_id: SESSION_ID,
  reservation_id: null,
  stripe_refund_id: null,
  stripe_payment_intent_id: null,
  amount: 1000,
  payment_method: "cash" as const,
  reason: "商品不良",
  refunded_by: PROFILE_BA.id,
  refunded_at: new Date().toISOString(),
  status: "completed" as const,
  note: null,
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  findAssignedBusinessIdsByUserIdMock.mockResolvedValue([BIZ_A]);
  findAssignedBusinessIdsByStaffUserIdMock.mockResolvedValue([BIZ_A]);
  findTotalRefundedAmountMock.mockResolvedValue(0);
});

// ============================================================
// refundCash
// ============================================================
describe("refundCash", () => {
  it("business_admin が現金返金を実行できる", async () => {
    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    insertSaleRefundMock.mockResolvedValue(SAMPLE_REFUND);

    const result = await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 1000,
      reason: "商品不良",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(insertSaleRefundMock).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method: "cash",
          status: "completed",
          amount: 1000,
        }),
      );
    }
  });

  it("staff も現金返金を実行できる", async () => {
    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    insertSaleRefundMock.mockResolvedValue(SAMPLE_REFUND);

    const result = await refundCash(PROFILE_STAFF, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 500,
      reason: "返品",
      refundedBy: PROFILE_STAFF.id,
    });

    expect(result.ok).toBe(true);
  });

  it("一般ユーザーは返金できない（REFUND_MANAGE なし）", async () => {
    const result = await refundCash(PROFILE_USER, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 1000,
      reason: "返品",
      refundedBy: PROFILE_USER.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("別 business_id への返金は拒否される", async () => {
    findAssignedBusinessIdsByUserIdMock.mockResolvedValue(["other-biz"]);

    const result = await refundCash(PROFILE_OTHER_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 1000,
      reason: "返品",
      refundedBy: PROFILE_OTHER_BA.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("返金額が元の決済額を超える場合は 422 を返す", async () => {
    findSaleSessionAmountByIdMock.mockResolvedValue(500);

    const result = await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 1000,
      reason: "返品",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(422);
  });

  it("累積返金が残額を超える場合は 422 を返す", async () => {
    findSaleSessionAmountByIdMock.mockResolvedValue(1000);
    findTotalRefundedAmountMock.mockResolvedValue(800);

    const result = await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 300,
      reason: "返品",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(422);
  });

  it("予約に対する現金返金も実行できる", async () => {
    findReservationAmountByIdMock.mockResolvedValue(10000);
    insertSaleRefundMock.mockResolvedValue({ ...SAMPLE_REFUND, reservation_id: RES_ID });

    const result = await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      reservationId: RES_ID,
      amount: 3000,
      reason: "キャンセル返金",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
  });
});

// ============================================================
// refundCard
// ============================================================
describe("refundCard", () => {
  it("Stripe payment_intent_id がある場合は Stripe API を呼び出す", async () => {
    findReservationAmountByIdMock.mockResolvedValue(10000);
    stripeRefundsCreateMock.mockResolvedValue({ id: "re_stripe_123" });
    insertSaleRefundMock.mockResolvedValue({
      ...SAMPLE_REFUND,
      payment_method: "card",
      stripe_refund_id: "re_stripe_123",
    });

    const result = await refundCard(PROFILE_BA, {
      businessId: BIZ_A,
      reservationId: RES_ID,
      stripePaymentIntentId: "pi_test_123",
      amount: 5000,
      reason: "返品",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    expect(stripeRefundsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_test_123",
        amount: 5000,
      }),
    );
  });

  it("Stripe ID がない場合は Stripe API を呼ばずに記録する", async () => {
    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    insertSaleRefundMock.mockResolvedValue({ ...SAMPLE_REFUND, payment_method: "card" });

    const result = await refundCard(PROFILE_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 1000,
      reason: "手動カード返金",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    expect(stripeRefundsCreateMock).not.toHaveBeenCalled();
  });

  it("予約の場合は自動で Stripe payment_intent_id を取得する", async () => {
    findReservationAmountByIdMock.mockResolvedValue(10000);
    findStripePaymentIntentByReservationIdMock.mockResolvedValue("pi_auto_456");
    stripeRefundsCreateMock.mockResolvedValue({ id: "re_auto_456" });
    insertSaleRefundMock.mockResolvedValue({ ...SAMPLE_REFUND, payment_method: "card" });

    await refundCard(PROFILE_BA, {
      businessId: BIZ_A,
      reservationId: RES_ID,
      amount: 2000,
      reason: "自動取得テスト",
      refundedBy: PROFILE_BA.id,
    });

    expect(findStripePaymentIntentByReservationIdMock).toHaveBeenCalledWith(RES_ID);
    expect(stripeRefundsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_auto_456" }),
    );
  });
});

// ============================================================
// listRefunds
// ============================================================
describe("listRefunds", () => {
  it("business_admin が返金一覧を取得できる", async () => {
    findRefundsByBusinessIdMock.mockResolvedValue({ data: [SAMPLE_REFUND], count: 1 });

    const result = await listRefunds(PROFILE_BA, { businessId: BIZ_A });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.count).toBe(1);
  });

  it("他事業の返金一覧は 403 を返す", async () => {
    findAssignedBusinessIdsByUserIdMock.mockResolvedValue(["other-biz"]);

    const result = await listRefunds(PROFILE_OTHER_BA, { businessId: BIZ_A });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});

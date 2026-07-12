import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoRefundReservationOnCancel,
  refundCash,
  refundCard,
  listRefunds,
} from "@/lib/services/refund.service";

const {
  findAssignedBusinessIdsByUserIdMock,
  findAssignedBusinessIdsByStaffUserIdMock,
  insertSaleRefundMock,
  insertSaleRefundAdminMock,
  findRefundsByBusinessIdMock,
  findSaleSessionAmountByIdMock,
  findReservationAmountByIdMock,
  findReservationAmountByIdAdminMock,
  findTotalRefundedAmountMock,
  findTotalRefundedAmountAdminMock,
  findStripePaymentIntentByReservationIdMock,
  findStripePaymentIntentByReservationIdAdminMock,
  findStripePaymentIntentByOnlineOrderIdMock,
  findOnlineOrderAmountByIdMock,
  findSaleSessionSoldAtByIdMock,
  findReservationDateByIdMock,
  findReservationDateByIdAdminMock,
  stripeRefundsCreateMock,
  findClosingContainingSoldAtMock,
  findClosingContainingReservationDateMock,
  findClosingContainingReservationDateAdminMock,
  updatePostCloseRefundMock,
  findBySourceAdminMock,
  updatePaymentLedgerStatusAdminMock,
  updateOnlineOrderPaymentStatusMock,
} = vi.hoisted(() => ({
  findAssignedBusinessIdsByUserIdMock: vi.fn(),
  findAssignedBusinessIdsByStaffUserIdMock: vi.fn(),
  insertSaleRefundMock: vi.fn(),
  insertSaleRefundAdminMock: vi.fn(),
  findRefundsByBusinessIdMock: vi.fn(),
  findSaleSessionAmountByIdMock: vi.fn(),
  findReservationAmountByIdMock: vi.fn(),
  findReservationAmountByIdAdminMock: vi.fn(),
  findTotalRefundedAmountMock: vi.fn(),
  findTotalRefundedAmountAdminMock: vi.fn(),
  findStripePaymentIntentByReservationIdMock: vi.fn(),
  findStripePaymentIntentByReservationIdAdminMock: vi.fn(),
  findStripePaymentIntentByOnlineOrderIdMock: vi.fn(),
  findOnlineOrderAmountByIdMock: vi.fn(),
  findSaleSessionSoldAtByIdMock: vi.fn(),
  findReservationDateByIdMock: vi.fn(),
  findReservationDateByIdAdminMock: vi.fn(),
  stripeRefundsCreateMock: vi.fn(),
  findClosingContainingSoldAtMock: vi.fn(),
  findClosingContainingReservationDateMock: vi.fn(),
  findClosingContainingReservationDateAdminMock: vi.fn(),
  updatePostCloseRefundMock: vi.fn(),
  findBySourceAdminMock: vi.fn(),
  updatePaymentLedgerStatusAdminMock: vi.fn(),
  updateOnlineOrderPaymentStatusMock: vi.fn(),
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
  insertSaleRefundAdmin: insertSaleRefundAdminMock,
  updateSaleRefundStatus: vi.fn(),
  findRefundsByBusinessId: findRefundsByBusinessIdMock,
  findStripePaymentIntentByReservationId: findStripePaymentIntentByReservationIdMock,
  findStripePaymentIntentByReservationIdAdmin: findStripePaymentIntentByReservationIdAdminMock,
  findStripePaymentIntentByOnlineOrderId: findStripePaymentIntentByOnlineOrderIdMock,
  findSaleSessionAmountById: findSaleSessionAmountByIdMock,
  findReservationAmountById: findReservationAmountByIdMock,
  findReservationAmountByIdAdmin: findReservationAmountByIdAdminMock,
  findOnlineOrderAmountById: findOnlineOrderAmountByIdMock,
  findTotalRefundedAmount: findTotalRefundedAmountMock,
  findTotalRefundedAmountAdmin: findTotalRefundedAmountAdminMock,
  findSaleSessionSoldAtById: findSaleSessionSoldAtByIdMock,
  findReservationDateById: findReservationDateByIdMock,
  findReservationDateByIdAdmin: findReservationDateByIdAdminMock,
}));

vi.mock("@/lib/repositories/register-closings.repository", () => ({
  findClosingContainingSoldAt: findClosingContainingSoldAtMock,
  findClosingContainingReservationDate: findClosingContainingReservationDateMock,
  findClosingContainingReservationDateAdmin: findClosingContainingReservationDateAdminMock,
  updatePostCloseRefund: updatePostCloseRefundMock,
}));

vi.mock("@/lib/repositories/payment-ledger.repository", () => ({
  findBySourceAdmin: findBySourceAdminMock,
  updatePaymentLedgerStatusAdmin: updatePaymentLedgerStatusAdminMock,
}));

vi.mock("@/lib/repositories/online-order.repository", () => ({
  updateOnlineOrderPaymentStatus: updateOnlineOrderPaymentStatusMock,
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

const SAMPLE_CLOSING = {
  id: "closing-1",
  business_id: BIZ_A,
  location_id: null,
  closed_by: "ba-user-id",
  closed_at: "2026-06-25T18:00:00Z",
  period_start: "2026-06-25T00:00:00Z",
  period_end: "2026-06-25T18:00:00Z",
  total_cash: 5000,
  total_card: 3000,
  total_other: 1000,
  total_amount: 9000,
  post_close_refund_cash: 0,
  post_close_refund_card: 0,
  post_close_refund_other: 0,
  post_close_refund_total: 0,
  note: null,
  status: "closed" as const,
  created_at: "2026-06-25T18:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  findAssignedBusinessIdsByUserIdMock.mockResolvedValue([BIZ_A]);
  findAssignedBusinessIdsByStaffUserIdMock.mockResolvedValue([BIZ_A]);
  findTotalRefundedAmountMock.mockResolvedValue(0);
  findTotalRefundedAmountAdminMock.mockResolvedValue(0);
  findSaleSessionSoldAtByIdMock.mockResolvedValue(null);
  findReservationDateByIdMock.mockResolvedValue(null);
  findReservationDateByIdAdminMock.mockResolvedValue(null);
  findClosingContainingSoldAtMock.mockResolvedValue(null);
  findClosingContainingReservationDateMock.mockResolvedValue(null);
  findClosingContainingReservationDateAdminMock.mockResolvedValue(null);
  updatePostCloseRefundMock.mockResolvedValue(undefined);
  findBySourceAdminMock.mockResolvedValue(null);
  updatePaymentLedgerStatusAdminMock.mockResolvedValue(undefined);
  updateOnlineOrderPaymentStatusMock.mockResolvedValue(undefined);
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
// 締め後返金差分記録
// ============================================================
describe("refundCash — post_close_refund", () => {
  it("締め済み期間内のセッション返金で updatePostCloseRefund が呼ばれる", async () => {
    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    insertSaleRefundMock.mockResolvedValue(SAMPLE_REFUND);
    findSaleSessionSoldAtByIdMock.mockResolvedValue("2026-06-25T10:00:00Z");
    findClosingContainingSoldAtMock.mockResolvedValue(SAMPLE_CLOSING);

    const result = await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 1000,
      reason: "締め後返金テスト",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    expect(updatePostCloseRefundMock).toHaveBeenCalledWith({
      closingId: SAMPLE_CLOSING.id,
      paymentMethod: "cash",
      amount: 1000,
    });
  });

  it("締め済み期間外のセッション返金では updatePostCloseRefund が呼ばれない", async () => {
    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    insertSaleRefundMock.mockResolvedValue(SAMPLE_REFUND);
    findSaleSessionSoldAtByIdMock.mockResolvedValue("2026-06-25T10:00:00Z");
    findClosingContainingSoldAtMock.mockResolvedValue(null);

    const result = await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 1000,
      reason: "未締め返金",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    expect(updatePostCloseRefundMock).not.toHaveBeenCalled();
  });

  it("sold_at が取得できない場合も返金は成功し updatePostCloseRefund は呼ばれない", async () => {
    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    insertSaleRefundMock.mockResolvedValue(SAMPLE_REFUND);
    findSaleSessionSoldAtByIdMock.mockResolvedValue(null);

    const result = await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 1000,
      reason: "soldAt なし",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    expect(updatePostCloseRefundMock).not.toHaveBeenCalled();
  });

  it("予約返金で reservation_date を元に findClosingContainingReservationDate が呼ばれる", async () => {
    findReservationAmountByIdMock.mockResolvedValue(10000);
    insertSaleRefundMock.mockResolvedValue({ ...SAMPLE_REFUND, reservation_id: RES_ID });
    findReservationDateByIdMock.mockResolvedValue("2026-06-25");
    findClosingContainingReservationDateMock.mockResolvedValue(SAMPLE_CLOSING);

    const result = await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      reservationId: RES_ID,
      amount: 3000,
      reason: "予約締め後返金",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    expect(findClosingContainingSoldAtMock).not.toHaveBeenCalled();
    expect(findClosingContainingReservationDateMock).toHaveBeenCalledWith(
      BIZ_A,
      "2026-06-25",
    );
    expect(updatePostCloseRefundMock).toHaveBeenCalledWith({
      closingId: SAMPLE_CLOSING.id,
      paymentMethod: "cash",
      amount: 3000,
    });
  });

  it("updatePostCloseRefund が失敗しても返金自体は成功する", async () => {
    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    insertSaleRefundMock.mockResolvedValue(SAMPLE_REFUND);
    findSaleSessionSoldAtByIdMock.mockResolvedValue("2026-06-25T10:00:00Z");
    findClosingContainingSoldAtMock.mockResolvedValue(SAMPLE_CLOSING);
    updatePostCloseRefundMock.mockRejectedValue(new Error("DB エラー"));

    const result = await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 1000,
      reason: "更新失敗テスト",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
  });
});

describe("refundCard — post_close_refund", () => {
  it("カード返金成功時に締め記録が更新される", async () => {
    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    insertSaleRefundMock.mockResolvedValue({ ...SAMPLE_REFUND, payment_method: "card" });
    findSaleSessionSoldAtByIdMock.mockResolvedValue("2026-06-25T10:00:00Z");
    findClosingContainingSoldAtMock.mockResolvedValue(SAMPLE_CLOSING);

    const result = await refundCard(PROFILE_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 2000,
      reason: "カード締め後返金",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    expect(updatePostCloseRefundMock).toHaveBeenCalledWith({
      closingId: SAMPLE_CLOSING.id,
      paymentMethod: "card",
      amount: 2000,
    });
  });

  it("Stripe 返金失敗時は updatePostCloseRefund が呼ばれない", async () => {
    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    stripeRefundsCreateMock.mockRejectedValue(new Error("Stripe error"));
    insertSaleRefundMock.mockResolvedValue({
      ...SAMPLE_REFUND,
      payment_method: "card",
      status: "failed",
    });

    const result = await refundCard(PROFILE_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      stripePaymentIntentId: "pi_test_fail",
      amount: 2000,
      reason: "失敗テスト",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(false);
    expect(updatePostCloseRefundMock).not.toHaveBeenCalled();
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

// ============================================================
// 締め前後判定（recordPostCloseRefundIfNeeded）
// ============================================================
describe("recordPostCloseRefundIfNeeded — 締め前後タイミング判定", () => {
  it("返金日時が closed_at より後なら updatePostCloseRefund が呼ばれる（締め後）", async () => {
    // SAMPLE_CLOSING.closed_at = "2026-06-25T18:00:00Z"（過去）
    // 現在 (vi のデフォルト = システム時刻 ≈ 2026-06-27) > closed_at → 締め後
    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    insertSaleRefundMock.mockResolvedValue(SAMPLE_REFUND);
    findSaleSessionSoldAtByIdMock.mockResolvedValue("2026-06-25T10:00:00Z");
    findClosingContainingSoldAtMock.mockResolvedValue(SAMPLE_CLOSING);

    const result = await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      saleSessionId: SESSION_ID,
      amount: 1000,
      reason: "締め後確認テスト",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    expect(updatePostCloseRefundMock).toHaveBeenCalled();
  });

  it("返金日時が closed_at より前なら updatePostCloseRefund が呼ばれない（締め前）", async () => {
    // 現在時刻を closed_at より前に固定
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-25T17:00:00Z")); // closed_at = 18:00 より前

    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    insertSaleRefundMock.mockResolvedValue(SAMPLE_REFUND);
    findSaleSessionSoldAtByIdMock.mockResolvedValue("2026-06-25T10:00:00Z");
    findClosingContainingSoldAtMock.mockResolvedValue(SAMPLE_CLOSING);

    try {
      const result = await refundCash(PROFILE_BA, {
        businessId: BIZ_A,
        saleSessionId: SESSION_ID,
        amount: 1000,
        reason: "締め前テスト",
        refundedBy: PROFILE_BA.id,
      });

      expect(result.ok).toBe(true);
      expect(updatePostCloseRefundMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("closed_at の 1 秒後は締め後扱いになる", async () => {
    vi.useFakeTimers();
    // closed_at = "2026-06-25T18:00:00.000Z" → その 1 秒後を現在時刻に設定
    vi.setSystemTime(new Date("2026-06-25T18:00:01Z"));

    findSaleSessionAmountByIdMock.mockResolvedValue(5000);
    insertSaleRefundMock.mockResolvedValue(SAMPLE_REFUND);
    findSaleSessionSoldAtByIdMock.mockResolvedValue("2026-06-25T10:00:00Z");
    findClosingContainingSoldAtMock.mockResolvedValue(SAMPLE_CLOSING);

    try {
      const result = await refundCash(PROFILE_BA, {
        businessId: BIZ_A,
        saleSessionId: SESSION_ID,
        amount: 1000,
        reason: "締め直後テスト",
        refundedBy: PROFILE_BA.id,
      });

      // now (18:00:01) > closed_at (18:00:00) → 締め後 → updatePostCloseRefund が呼ばれる
      expect(result.ok).toBe(true);
      expect(updatePostCloseRefundMock).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ============================================================
// autoRefundReservationOnCancel（予約キャンセルに伴う自動全額返金）
// ============================================================
describe("autoRefundReservationOnCancel", () => {
  const PAYMENT_INTENT_ID = "pi_123";

  it("Stripe payment_intent が無い（現地決済・未決済）場合は何もしない", async () => {
    findStripePaymentIntentByReservationIdAdminMock.mockResolvedValue(null);

    const result = await autoRefundReservationOnCancel({
      reservationId: RES_ID,
      businessId: BIZ_A,
      refundedBy: PROFILE_BA.id,
      reason: "テスト",
    });

    expect(result).toEqual({ refunded: false, amount: 0, failed: false, failureNote: null });
    expect(stripeRefundsCreateMock).not.toHaveBeenCalled();
  });

  it("予約分＋アドオン分の合計額（未返金残額）で1回だけ Stripe 返金する", async () => {
    findStripePaymentIntentByReservationIdAdminMock.mockResolvedValue(PAYMENT_INTENT_ID);
    findReservationAmountByIdAdminMock.mockResolvedValue(12000); // 予約10000+アドオン2000
    findTotalRefundedAmountAdminMock.mockResolvedValue(0);
    stripeRefundsCreateMock.mockResolvedValue({ id: "re_1" });
    insertSaleRefundAdminMock.mockResolvedValue(SAMPLE_REFUND);
    findBySourceAdminMock.mockResolvedValue({ id: "ledger-1", status: "succeeded" });

    const result = await autoRefundReservationOnCancel({
      reservationId: RES_ID,
      businessId: BIZ_A,
      refundedBy: PROFILE_BA.id,
      reason: "予約キャンセルに伴う自動返金",
    });

    expect(stripeRefundsCreateMock).toHaveBeenCalledWith({
      payment_intent: PAYMENT_INTENT_ID,
      amount: 12000,
      reason: "requested_by_customer",
    });
    expect(insertSaleRefundAdminMock).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: BIZ_A,
        reservation_id: RES_ID,
        amount: 12000,
        payment_method: "card",
        refunded_by: PROFILE_BA.id,
        status: "completed",
      }),
    );
    expect(updatePaymentLedgerStatusAdminMock).toHaveBeenCalledWith("ledger-1", "refunded");
    expect(result).toEqual({ refunded: true, amount: 12000, failed: false, failureNote: null });
  });

  it("既に一部返金済みの場合は残額のみ返金する", async () => {
    findStripePaymentIntentByReservationIdAdminMock.mockResolvedValue(PAYMENT_INTENT_ID);
    findReservationAmountByIdAdminMock.mockResolvedValue(12000);
    findTotalRefundedAmountAdminMock.mockResolvedValue(5000);
    stripeRefundsCreateMock.mockResolvedValue({ id: "re_2" });
    insertSaleRefundAdminMock.mockResolvedValue(SAMPLE_REFUND);

    const result = await autoRefundReservationOnCancel({
      reservationId: RES_ID,
      businessId: BIZ_A,
      refundedBy: PROFILE_BA.id,
      reason: "テスト",
    });

    expect(stripeRefundsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 7000 }),
    );
    expect(result.amount).toBe(7000);
  });

  it("返金済み金額が確定金額に達している場合は何もしない", async () => {
    findStripePaymentIntentByReservationIdAdminMock.mockResolvedValue(PAYMENT_INTENT_ID);
    findReservationAmountByIdAdminMock.mockResolvedValue(12000);
    findTotalRefundedAmountAdminMock.mockResolvedValue(12000);

    const result = await autoRefundReservationOnCancel({
      reservationId: RES_ID,
      businessId: BIZ_A,
      refundedBy: PROFILE_BA.id,
      reason: "テスト",
    });

    expect(stripeRefundsCreateMock).not.toHaveBeenCalled();
    expect(result.refunded).toBe(false);
  });

  it("Stripe 返金APIが失敗した場合は failed=true を返し、payment_ledger は更新しない", async () => {
    findStripePaymentIntentByReservationIdAdminMock.mockResolvedValue(PAYMENT_INTENT_ID);
    findReservationAmountByIdAdminMock.mockResolvedValue(12000);
    findTotalRefundedAmountAdminMock.mockResolvedValue(0);
    stripeRefundsCreateMock.mockRejectedValue(new Error("card_declined"));
    insertSaleRefundAdminMock.mockResolvedValue({ ...SAMPLE_REFUND, status: "failed" });

    const result = await autoRefundReservationOnCancel({
      reservationId: RES_ID,
      businessId: BIZ_A,
      refundedBy: PROFILE_BA.id,
      reason: "テスト",
    });

    expect(result.failed).toBe(true);
    expect(result.refunded).toBe(false);
    expect(updatePaymentLedgerStatusAdminMock).not.toHaveBeenCalled();
  });
});

// ============================================================
// 追加購入注文（online_orders）への返金（Phase 19E）
// ============================================================
describe("refundCash / refundCard — onlineOrderId ターゲット", () => {
  const ORDER_ID = "order-3333-3333-3333-333333333333";

  it("refundCash: 追加購入注文への現金返金を実行できる", async () => {
    findOnlineOrderAmountByIdMock.mockResolvedValue(3000);
    insertSaleRefundMock.mockResolvedValue({ ...SAMPLE_REFUND, online_order_id: ORDER_ID });

    const result = await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      onlineOrderId: ORDER_ID,
      amount: 3000,
      reason: "商品不良",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    expect(insertSaleRefundMock).toHaveBeenCalledWith(
      expect.objectContaining({ online_order_id: ORDER_ID, sale_session_id: null, reservation_id: null }),
    );
  });

  it("refundCash: 全額返金の場合は online_orders.payment_status を refunded に更新する", async () => {
    findOnlineOrderAmountByIdMock.mockResolvedValue(3000);
    findTotalRefundedAmountMock.mockResolvedValue(0);
    insertSaleRefundMock.mockResolvedValue({ ...SAMPLE_REFUND, online_order_id: ORDER_ID });

    await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      onlineOrderId: ORDER_ID,
      amount: 3000,
      reason: "全額返金",
      refundedBy: PROFILE_BA.id,
    });

    expect(updateOnlineOrderPaymentStatusMock).toHaveBeenCalledWith(ORDER_ID, "refunded");
  });

  it("refundCash: 部分返金の場合は payment_status を更新しない", async () => {
    findOnlineOrderAmountByIdMock.mockResolvedValue(3000);
    findTotalRefundedAmountMock.mockResolvedValue(0);
    insertSaleRefundMock.mockResolvedValue({ ...SAMPLE_REFUND, online_order_id: ORDER_ID, amount: 1000 });

    await refundCash(PROFILE_BA, {
      businessId: BIZ_A,
      onlineOrderId: ORDER_ID,
      amount: 1000,
      reason: "部分返金",
      refundedBy: PROFILE_BA.id,
    });

    expect(updateOnlineOrderPaymentStatusMock).not.toHaveBeenCalled();
  });

  it("refundCard: onlineOrderId から Stripe payment_intent_id を自動取得する", async () => {
    findOnlineOrderAmountByIdMock.mockResolvedValue(3000);
    findStripePaymentIntentByOnlineOrderIdMock.mockResolvedValue("pi_order_789");
    stripeRefundsCreateMock.mockResolvedValue({ id: "re_order_789" });
    insertSaleRefundMock.mockResolvedValue({
      ...SAMPLE_REFUND,
      online_order_id: ORDER_ID,
      payment_method: "card",
    });

    const result = await refundCard(PROFILE_BA, {
      businessId: BIZ_A,
      onlineOrderId: ORDER_ID,
      amount: 3000,
      reason: "カード返金",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(true);
    expect(findStripePaymentIntentByOnlineOrderIdMock).toHaveBeenCalledWith(ORDER_ID);
    expect(stripeRefundsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_order_789", amount: 3000 }),
    );
    expect(updateOnlineOrderPaymentStatusMock).toHaveBeenCalledWith(ORDER_ID, "refunded");
  });

  it("refundCard: 返金額が注文合計を超える場合は 422 を返す", async () => {
    findOnlineOrderAmountByIdMock.mockResolvedValue(2000);

    const result = await refundCard(PROFILE_BA, {
      businessId: BIZ_A,
      onlineOrderId: ORDER_ID,
      amount: 3000,
      reason: "超過",
      refundedBy: PROFILE_BA.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(422);
    expect(stripeRefundsCreateMock).not.toHaveBeenCalled();
  });
});

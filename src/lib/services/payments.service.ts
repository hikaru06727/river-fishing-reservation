import { revalidatePath } from "next/cache";
import {
  findReservationPaymentMetaByIdAdmin,
  markCashPaymentSucceededByReservationId,
} from "@/lib/repositories/payments.repository";
import {
  canMarkCashPaymentReceived,
  isCashPaymentAlreadyReceived,
} from "@/lib/reservations/mark-cash-payment-received";
import { recordPaymentLedger } from "@/lib/services/payment-ledger.service";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export type MarkCashPaymentReceivedResult = {
  reservationId: string;
  alreadyPaid: boolean;
};

export async function markCashPaymentReceived(
  reservationId: string,
): Promise<ServiceResult<MarkCashPaymentReceivedResult>> {
  // 現金精算の payments 更新のみ。完了メールは送らない（予約作成時の受付メールで案内済み）。
  const meta = await findReservationPaymentMetaByIdAdmin(reservationId);

  if (!meta) {
    return { ok: false, error: "予約が見つかりません。", status: 404 };
  }

  if (meta.payment_method !== "cash_at_venue") {
    return {
      ok: false,
      error: "オンライン決済の予約はこの操作の対象外です。",
      status: 422,
    };
  }

  if (meta.reservation_status !== "confirmed") {
    return {
      ok: false,
      error: "確定済みの現金精算予約のみ操作できます。",
      status: 422,
    };
  }

  if (!meta.payment) {
    return {
      ok: false,
      error: "決済レコードが見つかりません。管理者にお問い合わせください。",
      status: 422,
    };
  }

  const input = {
    payment_method: meta.payment_method,
    reservation_status: meta.reservation_status,
    payment_status: meta.payment.status,
  };

  if (isCashPaymentAlreadyReceived(input)) {
    revalidateAdminReservationPaths(reservationId);
    return {
      ok: true,
      data: { reservationId, alreadyPaid: true },
    };
  }

  if (!canMarkCashPaymentReceived(input)) {
    return {
      ok: false,
      error: "この予約は現地精算済みにできません。",
      status: 422,
    };
  }

  try {
    const paidAt = new Date().toISOString();
    const outcome = await markCashPaymentSucceededByReservationId(reservationId, paidAt);

    if (outcome === "updated" && meta.business_id) {
      try {
        await recordPaymentLedger({
          business_id: meta.business_id,
          source_type: "reservation",
          source_id: reservationId,
          amount: meta.total_amount_yen,
          payment_method: "cash",
          status: "succeeded",
          paid_at: paidAt,
        });
      } catch (e) {
        console.error("[markCashPaymentReceived] payment_ledger write failed:", e);
      }
    }

    revalidateAdminReservationPaths(reservationId);

    return {
      ok: true,
      data: {
        reservationId,
        alreadyPaid: outcome === "already_succeeded",
      },
    };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "PAYMENT_NOT_FOUND") {
        return {
          ok: false,
          error: "決済レコードが見つかりません。管理者にお問い合わせください。",
          status: 422,
        };
      }
      if (err.message === "INVALID_PAYMENT_STATUS") {
        return {
          ok: false,
          error: "決済状態が不正なため、更新できません。",
          status: 422,
        };
      }
    }

    console.error("[markCashPaymentReceived]", err);
    return {
      ok: false,
      error: "支払い済みへの更新に失敗しました。再度お試しください。",
      status: 500,
    };
  }
}

function revalidateAdminReservationPaths(reservationId: string) {
  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/reservations/${reservationId}`);
  revalidatePath("/my/reservations");
  revalidatePath(`/my/reservations/${reservationId}`);
}

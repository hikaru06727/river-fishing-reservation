import { revalidatePath } from "next/cache";
import { canCancelReservation } from "@/lib/reservations/cancel-policy";
import {
  getEffectiveBusinessHoursForDate,
  hasBusinessHoursConfigured,
  isReservationWithinBusinessHours,
} from "@/lib/business-hours/effective-hours";
import {
  getEffectiveBreaksForDate,
  hasBreaksConfigured,
  isReservationOverlappingBreaks,
} from "@/lib/business-hours/effective-breaks";
import {
  findExceptionBreaksBySpotAndDateRange,
  findWeeklyBreaksBySpotId,
} from "@/lib/repositories/business-breaks.repository";
import {
  findDateExceptionsBySpotAndDateRange,
  findWeeklyHoursBySpotId,
} from "@/lib/repositories/business-hours.repository";
import {
  fetchAffectedSlots,
  getAffectedSlotStartTimes,
  validateAffectedSlotsCapacity,
} from "@/lib/slots/affected-slots";
import { validateGuestCountForPlan } from "@/lib/plans/plan-reservation-rules";
import {
  findActivePlanForReservation,
  findPlanById,
} from "@/lib/repositories/plans.repository";
import {
  cancelReservationAtomic,
  createReservationAtomic,
  findReservationByIdAdmin,
  findReservationByIdForUser,
  findSpotNotificationMetaById,
  insertPendingPaymentForReservation,
  updateReservationPlanSnapshot,
} from "@/lib/repositories/reservations.repository";
import { getCurrentTaxRate } from "@/lib/repositories/tax-rates.repository";
import { getReservationPlanDisplay } from "@/lib/reservations/plan-display";
import { resolveReservationDurationMinutes } from "@/lib/reservations/reservation-duration";
import {
  LEGACY_SLOT_STEP_MINUTES,
  slotStepMinutesFromSlotRow,
} from "@/lib/slots/slot-step";
import { findSlotById, findSlotByIdAdmin } from "@/lib/repositories/slots.repository";
import { addMinutes, toDbTime } from "@/lib/utils/date";
import {
  getExpiresAtForPaymentMethod,
  getInitialReservationStatusForPaymentMethod,
} from "@/lib/reservations/payment-method";
import { createReservationSchema, cancelReservationSchema } from "@/validations/reservation";
import { isAllowedLegacyHourlyStartTimeByDuration } from "@/lib/slots/start-time-rules";
import { sendReservationCancelledEmails } from "@/lib/email/reservation-cancellation-emails";
import { sendReservationCreatedEmails } from "@/lib/email/reservation-emails";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export type CreateReservationResult = {
  reservationId: string;
  redirectPath: string;
};

export type CancelReservationResult = {
  reservationId: string;
  refundInitiated: boolean;
};

export type CancelledBy = "customer" | "admin" | "business_admin";

export type CancelReservationOptions = {
  isAdmin?: boolean;
  cancelledBy?: CancelledBy;
};

function revalidateReservationPaths(spotId: string, spotSlug: string | null) {
  revalidatePath("/my/reservations");
  revalidatePath("/admin/reservations");
  revalidatePath(`/reserve/${spotId}`);
  if (spotSlug) {
    revalidatePath(`/spots/${spotSlug}`);
  }
}

function mapRpcErrorToHttpStatus(errorCode: string | null): number {
  switch (errorCode) {
    case "CAPACITY_EXCEEDED":
      return 409;
    case "NOT_FOUND":
      return 404;
    case "INVALID_STATUS":
    case "SLOT_CLOSED":
    case "DATE_MISMATCH":
    case "SLOT_MISMATCH":
    case "MISSING_SLOTS":
    case "INVALID_START_SLOT":
    case "INVALID_GUEST_COUNT":
    case "INVALID_SLOTS":
      return 422;
    case "INVALID_PAYMENT_METHOD":
    case "INVALID_EXPIRES_AT":
      return 422;
    default:
      return 500;
  }
}

export async function createReservation(
  userId: string,
  input: unknown,
): Promise<ServiceResult<CreateReservationResult>> {
  const parsed = createReservationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります",
      status: 422,
    };
  }

  const { spotId, planId, slotId, reservationDate, guestCount, paymentMethod } = parsed.data;

  const plan = await findActivePlanForReservation(planId, spotId);
  if (!plan) {
    return { ok: false, error: "選択されたプランが見つかりません", status: 422 };
  }

  const guestValidation = validateGuestCountForPlan(guestCount, plan);
  if (!guestValidation.ok) {
    return { ok: false, error: guestValidation.error, status: 422 };
  }

  const startSlot = await findSlotById(slotId, spotId);
  if (!startSlot || startSlot.status !== "open") {
    return { ok: false, error: "選択された空き枠が見つかりません", status: 422 };
  }

  if (startSlot.slot_date !== reservationDate) {
    return { ok: false, error: "利用日と空き枠が一致しません", status: 422 };
  }

  const slotStepMinutes = slotStepMinutesFromSlotRow(
    startSlot.start_time,
    startSlot.end_time,
  );
  if (slotStepMinutes === null) {
    return { ok: false, error: "選択された空き枠の形式が不正です", status: 422 };
  }

  if (plan.duration_minutes % slotStepMinutes !== 0) {
    return { ok: false, error: "選択されたプランはこの空き枠では利用できません", status: 422 };
  }

  if (slotStepMinutes === LEGACY_SLOT_STEP_MINUTES) {
    if (
      !isAllowedLegacyHourlyStartTimeByDuration(
        plan.duration_minutes,
        startSlot.start_time,
      )
    ) {
      return { ok: false, error: "選択できない時間帯です", status: 422 };
    }
  }

  const affectedStartTimes = getAffectedSlotStartTimes(
    startSlot.start_time,
    plan.duration_minutes,
    slotStepMinutes,
  );

  if (affectedStartTimes.length === 0) {
    return { ok: false, error: "選択できない時間帯です", status: 422 };
  }

  const { slots: affectedSlots, error: fetchError } = await fetchAffectedSlots(
    spotId,
    reservationDate,
    affectedStartTimes,
  );

  if (fetchError) {
    return { ok: false, error: "空き枠情報の取得に失敗しました", status: 500 };
  }

  const validation = validateAffectedSlotsCapacity(
    affectedSlots,
    affectedStartTimes,
    guestCount,
  );

  if (!validation.valid) {
    return { ok: false, error: validation.message, status: 422 };
  }

  const weeklyHours = await findWeeklyHoursBySpotId(spotId);
  if (hasBusinessHoursConfigured(weeklyHours)) {
    const exceptions = await findDateExceptionsBySpotAndDateRange(
      spotId,
      reservationDate,
      reservationDate,
    );
    const effective = getEffectiveBusinessHoursForDate(
      weeklyHours,
      exceptions,
      reservationDate,
    );
    if (
      !isReservationWithinBusinessHours(
        effective,
        startSlot.start_time,
        plan.duration_minutes,
      )
    ) {
      return { ok: false, error: "選択できない時間帯です", status: 422 };
    }

    const weeklyBreaks = await findWeeklyBreaksBySpotId(spotId);
    const exceptionBreakRows = await findExceptionBreaksBySpotAndDateRange(
      spotId,
      reservationDate,
      reservationDate,
    );
    if (
      hasBreaksConfigured(
        weeklyBreaks,
        exceptionBreakRows.map((row) => ({
          date_exception_id: row.date_exception_id,
          start_time: row.start_time,
          end_time: row.end_time,
          label: row.label,
        })),
      )
    ) {
      const breaks = getEffectiveBreaksForDate(
        weeklyBreaks,
        exceptionBreakRows.map((row) => ({
          date_exception_id: row.date_exception_id,
          start_time: row.start_time,
          end_time: row.end_time,
          label: row.label,
        })),
        exceptions.map((row) => ({
          id: row.id,
          exception_date: row.exception_date,
          is_open: row.is_open,
          open_time: row.open_time,
          close_time: row.close_time,
          is_24_hours: row.is_24_hours,
          note: row.note,
          ignore_weekly_breaks: row.ignore_weekly_breaks,
        })),
        reservationDate,
      );
      if (
        isReservationOverlappingBreaks(
          startSlot.start_time,
          plan.duration_minutes,
          breaks,
        )
      ) {
        return {
          ok: false,
          error: "選択した時間は休み時間と重なるため予約できません",
          status: 422,
        };
      }
    }
  }

  const startTime = toDbTime(startSlot.start_time);
  const endTime = toDbTime(addMinutes(startSlot.start_time.slice(0, 5), plan.duration_minutes));
  const onlineExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const expiresAt = getExpiresAtForPaymentMethod(paymentMethod, onlineExpiresAt);
  const reservationStatus = getInitialReservationStatusForPaymentMethod(paymentMethod);
  const totalAmount = plan.price_yen * guestCount;

  try {
    const rpcResult = await createReservationAtomic({
      user_id: userId,
      spot_id: spotId,
      plan_id: planId,
      slot_id: slotId,
      reservation_date: reservationDate,
      start_time: startTime,
      end_time: endTime,
      guest_count: guestCount,
      total_amount_yen: totalAmount,
      status: reservationStatus,
      payment_method: paymentMethod,
      expires_at: expiresAt,
      affected_slot_ids: affectedSlots.map((s) => s.id),
    });

    if (!rpcResult.success || !rpcResult.reservation_id) {
      const status = mapRpcErrorToHttpStatus(rpcResult.error_code);
      const message =
        rpcResult.error_message ??
        (status === 409
          ? "空き枠が不足しています。時間をおいて再度お試しください。"
          : "予約の作成に失敗しました。再度お試しください。");

      return { ok: false, error: message, status };
    }

    const spotMeta = await findSpotNotificationMetaById(spotId);
    revalidateReservationPaths(spotId, spotMeta?.slug ?? null);

    if (paymentMethod === "cash_at_venue") {
      try {
        await insertPendingPaymentForReservation(rpcResult.reservation_id, totalAmount);
      } catch (paymentErr) {
        console.error("[createReservation] cash payment record failed:", paymentErr);
        // 予約自体は確定済みのためロールバックしない（将来: 管理者通知）
      }
    }

    let taxRatePercent: number | null = null;
    try {
      const taxRate = await getCurrentTaxRate();
      taxRatePercent = taxRate?.rate_percent ?? null;
    } catch (taxErr) {
      console.warn("[createReservation] tax rate fetch failed:", taxErr);
    }

    const planSnapshot = {
      reserved_plan_name: plan.name,
      reserved_unit_price_yen: plan.price_yen,
      reserved_duration_minutes: plan.duration_minutes,
      tax_rate_percent: taxRatePercent,
    };

    try {
      await updateReservationPlanSnapshot(rpcResult.reservation_id, planSnapshot);
    } catch (snapshotErr) {
      console.warn(
        "[createReservation] plan snapshot update failed:",
        rpcResult.reservation_id,
        snapshotErr,
      );
    }

    void sendReservationCreatedEmails({
      reservationId: rpcResult.reservation_id,
      userId,
      spotName: spotMeta?.name ?? "釣り場",
      businessId: spotMeta?.businessId ?? null,
      planName: planSnapshot.reserved_plan_name,
      reservationDate,
      startTime,
      endTime,
      guestCount,
      totalAmountYen: totalAmount,
      status: reservationStatus,
      paymentMethod,
    }).catch((err) => {
      console.warn("[createReservation] reservation email notification error:", err);
    });

    return {
      ok: true,
      data: {
        reservationId: rpcResult.reservation_id,
        redirectPath: `/reservation/confirm/${rpcResult.reservation_id}`,
      },
    };
  } catch (err) {
    console.error("[createReservation]", err);
    if (err instanceof Error) {
      console.error("[createReservation] error details:", {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    } else {
      console.error("[createReservation] non-Error thrown:", err);
    }
    return { ok: false, error: "予約の作成に失敗しました。再度お試しください。", status: 500 };
  }
}

export async function cancelReservation(
  userId: string,
  input: unknown,
  options: CancelReservationOptions = {},
): Promise<ServiceResult<CancelReservationResult>> {
  const parsed = cancelReservationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります",
      status: 422,
    };
  }

  const { reservationId } = parsed.data;
  const isAdmin = options.isAdmin ?? false;
  const cancelledBy: CancelledBy =
    options.cancelledBy ?? (isAdmin ? "admin" : "customer");

  const reservation = isAdmin
    ? await findReservationByIdAdmin(reservationId)
    : await findReservationByIdForUser(reservationId, userId);

  if (!reservation) {
    return { ok: false, error: "予約が見つかりません。", status: 404 };
  }

  const policy = canCancelReservation({
    status: reservation.status,
    reservationDate: reservation.reservation_date,
    startTime: reservation.start_time,
    isAdmin,
  });

  if (!policy.allowed) {
    return {
      ok: false,
      error: policy.reason ?? "この予約はキャンセルできません。",
      status: 422,
    };
  }

  const durationMinutes = resolveReservationDurationMinutes({
    reserved_duration_minutes: reservation.reserved_duration_minutes,
    start_time: reservation.start_time,
    end_time: reservation.end_time,
  });
  if (durationMinutes == null) {
    return {
      ok: false,
      error: "予約時間の取得に失敗しました。",
      status: 500,
    };
  }

  const startSlot = await findSlotByIdAdmin(reservation.slot_id);
  if (!startSlot) {
    return { ok: false, error: "空き枠情報の取得に失敗しました。", status: 500 };
  }

  const slotStepMinutes = slotStepMinutesFromSlotRow(
    startSlot.start_time,
    startSlot.end_time,
  );
  if (slotStepMinutes === null) {
    return { ok: false, error: "空き枠情報の取得に失敗しました。", status: 500 };
  }

  if (durationMinutes % slotStepMinutes !== 0) {
    return { ok: false, error: "予約時間の取得に失敗しました。", status: 500 };
  }

  const affectedStartTimes = getAffectedSlotStartTimes(
    startSlot.start_time,
    durationMinutes,
    slotStepMinutes,
  );

  if (affectedStartTimes.length === 0) {
    return { ok: false, error: "予約時間の取得に失敗しました。", status: 500 };
  }

  const { slots: affectedSlots, error: fetchError } = await fetchAffectedSlots(
    reservation.spot_id,
    startSlot.slot_date,
    affectedStartTimes,
  );

  if (fetchError) {
    return { ok: false, error: "空き枠情報の取得に失敗しました", status: 500 };
  }

  if (affectedSlots.length !== affectedStartTimes.length) {
    return {
      ok: false,
      error: "キャンセルに必要な空き枠が見つかりません。",
      status: 422,
    };
  }

  try {
    const rpcResult = await cancelReservationAtomic({
      reservation_id: reservationId,
      user_id: reservation.user_id,
      affected_slot_ids: affectedSlots.map((s) => s.id),
      guest_count: reservation.guest_count,
    });

    if (!rpcResult.success || !rpcResult.reservation_id) {
      const status = mapRpcErrorToHttpStatus(rpcResult.error_code);
      return {
        ok: false,
        error:
          rpcResult.error_message ??
          "予約のキャンセルに失敗しました。再度お試しください。",
        status,
      };
    }

    // 将来: Stripe 返金（refunds.create）をここで実行する。
    // confirmed かつ payments.status === 'succeeded' の場合のみ対象。
    // 返金失敗時はログ記録 + 管理者通知とし、予約キャンセル自体はロールバックしない。
    const refundInitiated = false;

    const spotMeta = await findSpotNotificationMetaById(reservation.spot_id);
    revalidateReservationPaths(reservation.spot_id, spotMeta?.slug ?? null);
    revalidatePath(`/my/reservations/${reservationId}`);

    const plan = await findPlanById(reservation.plan_id);
    const planDisplay = getReservationPlanDisplay(
      {
        ...reservation,
        plans: plan ? { name: plan.name } : null,
      },
      { nameFallback: "プラン" },
    );

    void sendReservationCancelledEmails({
      reservationId,
      customerUserId: reservation.user_id,
      spotName: spotMeta?.name ?? "釣り場",
      businessId: spotMeta?.businessId ?? null,
      planName: planDisplay.name,
      reservationDate: reservation.reservation_date,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      guestCount: reservation.guest_count,
      cancelledBy,
    }).catch((err) => {
      console.warn("[cancelReservation] cancellation email notification error:", err);
    });

    return { ok: true, data: { reservationId, refundInitiated } };
  } catch (err) {
    console.error("[cancelReservation]", err);
    return {
      ok: false,
      error: "予約のキャンセルに失敗しました。再度お試しください。",
      status: 500,
    };
  }
}

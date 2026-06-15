import { revalidatePath } from "next/cache";
import {
  fetchAffectedSlots,
  getAffectedSlotStartTimes,
  validateAffectedSlotsCapacity,
} from "@/lib/slots/affected-slots";
import { findActivePlanById, findPlanById } from "@/lib/repositories/plans.repository";
import {
  cancelReservationAtomic,
  createReservationAtomic,
  findReservationByIdForUser,
  findSpotSlugById,
} from "@/lib/repositories/reservations.repository";
import { findSlotById, findSlotByIdAdmin } from "@/lib/repositories/slots.repository";
import { addMinutes, toDbTime } from "@/lib/utils/date";
import { createReservationSchema, cancelReservationSchema, isAllowedStartTime } from "@/validations/reservation";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export type CreateReservationResult = {
  reservationId: string;
  redirectPath: string;
};

export type CancelReservationResult = {
  reservationId: string;
};

function revalidateReservationPaths(spotId: string, spotSlug: string | null) {
  revalidatePath("/my/reservations");
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

  const { spotId, planId, slotId, reservationDate, guestCount } = parsed.data;

  const plan = await findActivePlanById(planId);
  if (!plan) {
    return { ok: false, error: "選択されたプランが見つかりません", status: 422 };
  }

  const startSlot = await findSlotById(slotId, spotId);
  if (!startSlot || startSlot.status !== "open") {
    return { ok: false, error: "選択された空き枠が見つかりません", status: 422 };
  }

  if (startSlot.slot_date !== reservationDate) {
    return { ok: false, error: "利用日と空き枠が一致しません", status: 422 };
  }

  if (!isAllowedStartTime(plan.slug, startSlot.start_time)) {
    return { ok: false, error: "選択できない時間帯です", status: 422 };
  }

  const affectedStartTimes = getAffectedSlotStartTimes(
    startSlot.start_time,
    plan.duration_minutes,
  );

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

  const startTime = toDbTime(startSlot.start_time);
  const endTime = toDbTime(addMinutes(startSlot.start_time.slice(0, 5), plan.duration_minutes));
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
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
      status: "pending",
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

    const spotSlug = await findSpotSlugById(spotId);
    revalidateReservationPaths(spotId, spotSlug);

    return {
      ok: true,
      data: {
        reservationId: rpcResult.reservation_id,
        redirectPath: `/reservation/confirm/${rpcResult.reservation_id}`,
      },
    };
  } catch (err) {
    console.error("[createReservation]", err);
    return { ok: false, error: "予約の作成に失敗しました。再度お試しください。", status: 500 };
  }
}

export async function cancelReservation(
  userId: string,
  input: unknown,
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

  const reservation = await findReservationByIdForUser(reservationId, userId);

  if (!reservation) {
    return { ok: false, error: "予約が見つかりません。", status: 404 };
  }

  if (reservation.status !== "pending" && reservation.status !== "confirmed") {
    return { ok: false, error: "この予約はキャンセルできません。", status: 422 };
  }

  const plan = await findPlanById(reservation.plan_id);
  if (!plan) {
    return { ok: false, error: "プラン情報の取得に失敗しました。", status: 500 };
  }

  const startSlot = await findSlotByIdAdmin(reservation.slot_id);
  if (!startSlot) {
    return { ok: false, error: "空き枠情報の取得に失敗しました。", status: 500 };
  }

  const affectedStartTimes = getAffectedSlotStartTimes(
    startSlot.start_time,
    plan.duration_minutes,
  );

  const { slots: affectedSlots, error: fetchError } = await fetchAffectedSlots(
    reservation.spot_id,
    startSlot.slot_date,
    affectedStartTimes,
  );

  if (fetchError) {
    return { ok: false, error: "空き枠情報の取得に失敗しました", status: 500 };
  }

  try {
    const rpcResult = await cancelReservationAtomic({
      reservation_id: reservationId,
      user_id: userId,
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

    const spotSlug = await findSpotSlugById(reservation.spot_id);
    revalidateReservationPaths(reservation.spot_id, spotSlug);

    return { ok: true, data: { reservationId } };
  } catch (err) {
    console.error("[cancelReservation]", err);
    return {
      ok: false,
      error: "予約のキャンセルに失敗しました。再度お試しください。",
      status: 500,
    };
  }
}

import { revalidatePath } from "next/cache";
import { findAssignedBusinessIdsByUserId, findSpotBusinessIdBySpotId } from "@/lib/repositories/businesses.repository";
import {
  deleteDateExceptionById,
  findDateExceptionSpotIdById,
  findDateExceptionsBySpotId,
  findWeeklyHoursBySpotId,
  insertDateException,
  updateDateExceptionById,
  upsertWeeklyHoursForSpot,
} from "@/lib/repositories/business-hours.repository";
import { canManageBusinessHoursForProfile } from "@/lib/business-hours/business-hours-access";
import { isAdminRole } from "@/lib/auth/role";
import type {
  DateExceptionFormInput,
  WeeklyHoursFormInput,
} from "@/validations/business-hours";
import type { FishingSpotDateException, FishingSpotWeeklyHour, Profile } from "@/types/database";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

type MutationContext = {
  profile: Pick<Profile, "role" | "id">;
  assignedBusinessIds: readonly string[];
};

async function buildMutationContext(
  profile: Pick<Profile, "role" | "id">,
): Promise<MutationContext> {
  if (isAdminRole(profile.role)) {
    return { profile, assignedBusinessIds: [] };
  }

  const assignedBusinessIds = await findAssignedBusinessIdsByUserId(profile.id);
  return { profile, assignedBusinessIds };
}

async function assertCanManageSpot(
  context: MutationContext,
  spotId: string,
): Promise<ServiceResult<null>> {
  let spotBusinessId: string | null;
  try {
    spotBusinessId = await findSpotBusinessIdBySpotId(spotId);
  } catch {
    return { ok: false, error: "釣り場情報の取得に失敗しました。", status: 500 };
  }

  if (
    !canManageBusinessHoursForProfile(
      context.profile,
      spotBusinessId,
      context.assignedBusinessIds,
    )
  ) {
    return {
      ok: false,
      error: "この釣り場の営業時間を操作する権限がありません。",
      status: 403,
    };
  }

  return { ok: true, data: null };
}

function revalidateBusinessHoursPaths(spotId: string) {
  revalidatePath("/admin/business-hours");
  revalidatePath(`/admin/business-hours?spotId=${spotId}`);
  revalidatePath(`/reserve/${spotId}`);
}

function toWeeklyUpsertRows(input: WeeklyHoursFormInput) {
  return input.days.map((day) => ({
    day_of_week: day.dayOfWeek,
    is_open: day.isOpen,
    open_time: day.openTime,
    close_time: day.closeTime,
    is_24_hours: day.is24Hours,
  }));
}

function toExceptionUpsertInput(input: DateExceptionFormInput) {
  return {
    exception_date: input.exceptionDate,
    is_open: input.isOpen,
    open_time: input.openTime,
    close_time: input.closeTime,
    is_24_hours: input.is24Hours,
    note: input.note ?? null,
    ignore_weekly_breaks: input.ignoreWeeklyBreaks ?? false,
    tag_type: input.tagType ?? null,
  };
}

export async function getWeeklyHoursForSpot(
  profile: Pick<Profile, "role" | "id">,
  spotId: string,
): Promise<ServiceResult<FishingSpotWeeklyHour[]>> {
  const context = await buildMutationContext(profile);
  const access = await assertCanManageSpot(context, spotId);
  if (!access.ok) {
    return access;
  }

  try {
    const rows = await findWeeklyHoursBySpotId(spotId);
    return { ok: true, data: rows };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "営業時間の取得に失敗しました。",
      status: 500,
    };
  }
}

export async function getDateExceptionsForSpot(
  profile: Pick<Profile, "role" | "id">,
  spotId: string,
): Promise<ServiceResult<FishingSpotDateException[]>> {
  const context = await buildMutationContext(profile);
  const access = await assertCanManageSpot(context, spotId);
  if (!access.ok) {
    return access;
  }

  try {
    const rows = await findDateExceptionsBySpotId(spotId);
    return { ok: true, data: rows };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "例外日の取得に失敗しました。",
      status: 500,
    };
  }
}

export async function saveWeeklyHoursForSpot(
  profile: Pick<Profile, "role" | "id">,
  input: WeeklyHoursFormInput,
): Promise<ServiceResult<FishingSpotWeeklyHour[]>> {
  const context = await buildMutationContext(profile);
  const access = await assertCanManageSpot(context, input.fishingSpotId);
  if (!access.ok) {
    return access;
  }

  try {
    const rows = await upsertWeeklyHoursForSpot(
      input.fishingSpotId,
      toWeeklyUpsertRows(input),
    );
    revalidateBusinessHoursPaths(input.fishingSpotId);
    return { ok: true, data: rows };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "営業時間の保存に失敗しました。",
      status: 500,
    };
  }
}

export async function createDateExceptionForSpot(
  profile: Pick<Profile, "role" | "id">,
  input: DateExceptionFormInput,
): Promise<ServiceResult<FishingSpotDateException>> {
  const context = await buildMutationContext(profile);
  const access = await assertCanManageSpot(context, input.fishingSpotId);
  if (!access.ok) {
    return access;
  }

  try {
    const row = await insertDateException(input.fishingSpotId, toExceptionUpsertInput(input));
    revalidateBusinessHoursPaths(input.fishingSpotId);
    return { ok: true, data: row };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "例外日の追加に失敗しました。",
      status: 500,
    };
  }
}

export async function updateDateExceptionForSpot(
  profile: Pick<Profile, "role" | "id">,
  exceptionId: string,
  input: DateExceptionFormInput,
): Promise<ServiceResult<FishingSpotDateException>> {
  const context = await buildMutationContext(profile);

  let exceptionSpotId: string | null;
  try {
    exceptionSpotId = await findDateExceptionSpotIdById(exceptionId);
  } catch {
    return { ok: false, error: "例外日情報の取得に失敗しました。", status: 500 };
  }

  if (!exceptionSpotId || exceptionSpotId !== input.fishingSpotId) {
    return { ok: false, error: "例外日が見つかりません。", status: 404 };
  }

  const access = await assertCanManageSpot(context, input.fishingSpotId);
  if (!access.ok) {
    return access;
  }

  try {
    const row = await updateDateExceptionById(exceptionId, toExceptionUpsertInput(input));
    revalidateBusinessHoursPaths(input.fishingSpotId);
    return { ok: true, data: row };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "例外日の更新に失敗しました。",
      status: 500,
    };
  }
}

export async function deleteDateExceptionForSpot(
  profile: Pick<Profile, "role" | "id">,
  spotId: string,
  exceptionId: string,
): Promise<ServiceResult<null>> {
  const context = await buildMutationContext(profile);

  let exceptionSpotId: string | null;
  try {
    exceptionSpotId = await findDateExceptionSpotIdById(exceptionId);
  } catch {
    return { ok: false, error: "例外日情報の取得に失敗しました。", status: 500 };
  }

  if (!exceptionSpotId || exceptionSpotId !== spotId) {
    return { ok: false, error: "例外日が見つかりません。", status: 404 };
  }

  const access = await assertCanManageSpot(context, spotId);
  if (!access.ok) {
    return access;
  }

  try {
    await deleteDateExceptionById(exceptionId);
    revalidateBusinessHoursPaths(spotId);
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "例外日の削除に失敗しました。",
      status: 500,
    };
  }
}

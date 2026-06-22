import { revalidatePath } from "next/cache";
import { findOverlappingBreakPair } from "@/lib/business-hours/effective-breaks";
import { canManageBusinessHoursForProfile } from "@/lib/business-hours/business-hours-access";
import { isAdminRole } from "@/lib/auth/role";
import { findAssignedBusinessIdsByUserId, findSpotBusinessIdBySpotId } from "@/lib/repositories/businesses.repository";
import {
  findExceptionBreakSpotIdByExceptionId,
  findExceptionBreaksByExceptionId,
  findWeeklyBreaksBySpotId,
  replaceExceptionBreaksForException,
  replaceWeeklyBreaksForSpot,
} from "@/lib/repositories/business-breaks.repository";
import {
  findDateExceptionsBySpotId,
  updateDateExceptionById,
} from "@/lib/repositories/business-hours.repository";
import type {
  ExceptionBreaksFormInput,
  WeeklyBreaksFormInput,
} from "@/validations/business-breaks";
import type {
  FishingSpotExceptionBreak,
  FishingSpotWeeklyBreak,
  Profile,
} from "@/types/database";

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
      error: "この釣り場の休み時間を操作する権限がありません。",
      status: 403,
    };
  }

  return { ok: true, data: null };
}

function revalidateBreakPaths(spotId: string) {
  revalidatePath("/admin/business-hours");
  revalidatePath(`/admin/business-hours?spotId=${spotId}`);
  revalidatePath(`/reserve/${spotId}`);
}

function validateNoOverlaps(
  breaks: readonly { startTime: string; endTime: string }[],
  groupLabel: string,
): ServiceResult<null> {
  const overlap = findOverlappingBreakPair(breaks);
  if (overlap) {
    return {
      ok: false,
      error: `${groupLabel}の休み時間が重複しています（${overlap.indexA + 1}件目と${overlap.indexB + 1}件目）`,
      status: 422,
    };
  }
  return { ok: true, data: null };
}

function groupWeeklyBreaksByDay(breaks: WeeklyBreaksFormInput["breaks"]) {
  const byDay = new Map<number, { startTime: string; endTime: string }[]>();
  for (const row of breaks) {
    const list = byDay.get(row.dayOfWeek) ?? [];
    list.push({ startTime: row.startTime, endTime: row.endTime });
    byDay.set(row.dayOfWeek, list);
  }
  return byDay;
}

function normalizeDbTime(time: string | null): string | null {
  if (!time) {
    return null;
  }
  return time.slice(0, 5);
}

export async function getWeeklyBreaksForSpot(
  profile: Pick<Profile, "role" | "id">,
  spotId: string,
): Promise<ServiceResult<FishingSpotWeeklyBreak[]>> {
  const context = await buildMutationContext(profile);
  const access = await assertCanManageSpot(context, spotId);
  if (!access.ok) {
    return access;
  }

  try {
    const rows = await findWeeklyBreaksBySpotId(spotId);
    return { ok: true, data: rows };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "休み時間の取得に失敗しました。",
      status: 500,
    };
  }
}

export async function saveWeeklyBreaksForSpot(
  profile: Pick<Profile, "role" | "id">,
  input: WeeklyBreaksFormInput,
): Promise<ServiceResult<FishingSpotWeeklyBreak[]>> {
  const context = await buildMutationContext(profile);
  const access = await assertCanManageSpot(context, input.fishingSpotId);
  if (!access.ok) {
    return access;
  }

  for (const [dayOfWeek, rows] of groupWeeklyBreaksByDay(input.breaks)) {
    const overlapCheck = validateNoOverlaps(rows, `曜日(${dayOfWeek})`);
    if (!overlapCheck.ok) {
      return overlapCheck;
    }
  }

  try {
    const rows = await replaceWeeklyBreaksForSpot(
      input.fishingSpotId,
      input.breaks.map((row) => ({
        day_of_week: row.dayOfWeek,
        start_time: row.startTime,
        end_time: row.endTime,
        label: row.label ?? null,
      })),
    );
    revalidateBreakPaths(input.fishingSpotId);
    return { ok: true, data: rows };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "休み時間の保存に失敗しました。",
      status: 500,
    };
  }
}

export async function getExceptionBreaksForException(
  profile: Pick<Profile, "role" | "id">,
  spotId: string,
  exceptionId: string,
): Promise<ServiceResult<FishingSpotExceptionBreak[]>> {
  const context = await buildMutationContext(profile);
  const access = await assertCanManageSpot(context, spotId);
  if (!access.ok) {
    return access;
  }

  try {
    const ownerSpotId = await findExceptionBreakSpotIdByExceptionId(exceptionId);
    if (!ownerSpotId || ownerSpotId !== spotId) {
      return { ok: false, error: "例外日が見つかりません。", status: 404 };
    }

    const rows = await findExceptionBreaksByExceptionId(exceptionId);
    return { ok: true, data: rows };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "例外日休み時間の取得に失敗しました。",
      status: 500,
    };
  }
}

export async function saveExceptionBreaksForSpot(
  profile: Pick<Profile, "role" | "id">,
  input: ExceptionBreaksFormInput,
): Promise<ServiceResult<FishingSpotExceptionBreak[]>> {
  const context = await buildMutationContext(profile);
  const access = await assertCanManageSpot(context, input.fishingSpotId);
  if (!access.ok) {
    return access;
  }

  let ownerSpotId: string | null;
  try {
    ownerSpotId = await findExceptionBreakSpotIdByExceptionId(input.exceptionId);
  } catch {
    return { ok: false, error: "例外日情報の取得に失敗しました。", status: 500 };
  }

  if (!ownerSpotId || ownerSpotId !== input.fishingSpotId) {
    return { ok: false, error: "例外日が見つかりません。", status: 404 };
  }

  const overlapCheck = validateNoOverlaps(input.breaks, "例外日");
  if (!overlapCheck.ok) {
    return overlapCheck;
  }

  try {
    const exceptions = await findDateExceptionsBySpotId(input.fishingSpotId);
    const target = exceptions.find((row) => row.id === input.exceptionId);
    if (!target) {
      return { ok: false, error: "例外日が見つかりません。", status: 404 };
    }

    await updateDateExceptionById(input.exceptionId, {
      exception_date: target.exception_date,
      is_open: target.is_open,
      open_time: normalizeDbTime(target.open_time),
      close_time: normalizeDbTime(target.close_time),
      is_24_hours: target.is_24_hours,
      note: target.note,
      ignore_weekly_breaks: input.ignoreWeeklyBreaks,
      tag_type: target.tag_type,
    });

    const rows = await replaceExceptionBreaksForException(
      input.exceptionId,
      input.breaks.map((row) => ({
        start_time: row.startTime,
        end_time: row.endTime,
        label: row.label ?? null,
      })),
    );
    revalidateBreakPaths(input.fishingSpotId);
    return { ok: true, data: rows };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "例外日休み時間の保存に失敗しました。",
      status: 500,
    };
  }
}

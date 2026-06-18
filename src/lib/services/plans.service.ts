import { revalidatePath } from "next/cache";
import {
  findAssignedBusinessIdsByUserId,
  findSpotBusinessIdBySpotId,
} from "@/lib/repositories/businesses.repository";
import {
  findAdminPlanById,
  findPlanSpotIdByPlanId,
  insertPlan,
  updatePlanAcceptingReservationsById,
  updatePlanById,
  updatePlanVisibilityById,
  type InsertPlanInput,
  type UpdatePlanInput,
} from "@/lib/repositories/plans.repository";
import {
  canManagePlanForProfile,
  canManageSpotForProfile,
} from "@/lib/auth/management-access";
import { isAdminRole, isBusinessAdminRole } from "@/lib/auth/role";
import { generatePlanSlug } from "@/lib/utils/plan-slug";
import type { AdminPlanFormInput } from "@/validations/plan";
import type { Plan, Profile } from "@/types/database";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

type PlanMutationContext = {
  profile: Pick<Profile, "role" | "id">;
  assignedBusinessIds: readonly string[];
};

async function buildPlanMutationContext(
  profile: Pick<Profile, "role" | "id">,
): Promise<PlanMutationContext> {
  if (isAdminRole(profile.role)) {
    return { profile, assignedBusinessIds: [] };
  }

  const assignedBusinessIds = await findAssignedBusinessIdsByUserId(profile.id);
  return { profile, assignedBusinessIds };
}

async function assertCanManageSpotForPlan(
  context: PlanMutationContext,
  spotId: string,
): Promise<ServiceResult<null>> {
  let spotBusinessId: string | null;
  try {
    spotBusinessId = await findSpotBusinessIdBySpotId(spotId);
  } catch {
    return { ok: false, error: "釣り場情報の取得に失敗しました。", status: 500 };
  }

  if (
    !canManageSpotForProfile(
      context.profile,
      spotBusinessId,
      context.assignedBusinessIds,
    )
  ) {
    return { ok: false, error: "この釣り場のプランを操作する権限がありません。", status: 403 };
  }

  return { ok: true, data: null };
}

async function assertCanManageExistingPlan(
  context: PlanMutationContext,
  planId: string,
): Promise<ServiceResult<{ spotId: string | null }>> {
  let spotId: string | null;
  try {
    spotId = await findPlanSpotIdByPlanId(planId);
  } catch {
    return { ok: false, error: "プラン情報の取得に失敗しました。", status: 500 };
  }

  if (isBusinessAdminRole(context.profile.role) && !spotId) {
    return {
      ok: false,
      error: "共通プランは事業管理者から操作できません。",
      status: 403,
    };
  }

  let spotBusinessId: string | null = null;
  if (spotId) {
    try {
      spotBusinessId = await findSpotBusinessIdBySpotId(spotId);
    } catch {
      return { ok: false, error: "釣り場情報の取得に失敗しました。", status: 500 };
    }
  }

  if (
    !canManagePlanForProfile(
      context.profile,
      spotId,
      spotBusinessId,
      context.assignedBusinessIds,
    )
  ) {
    return { ok: false, error: "このプランを操作する権限がありません。", status: 403 };
  }

  return { ok: true, data: { spotId } };
}

function toInsertInput(
  input: AdminPlanFormInput,
  slug: string,
): InsertPlanInput {
  return {
    name: input.name,
    slug,
    description: input.description ?? null,
    duration_minutes: input.durationMinutes,
    price_yen: input.priceYen,
    max_guests: input.maxGuests,
    fishing_spot_id: input.fishingSpotId,
    is_visible: input.isVisible ?? true,
    is_accepting_reservations: input.isAcceptingReservations ?? true,
  };
}

function toUpdateInput(
  input: AdminPlanFormInput,
  existingSpotId: string | null,
  profileRole: Profile["role"],
): UpdatePlanInput {
  const keepLegacyGlobalPlan =
    existingSpotId == null && isAdminRole(profileRole);

  return {
    name: input.name,
    description: input.description ?? null,
    duration_minutes: input.durationMinutes,
    price_yen: input.priceYen,
    max_guests: input.maxGuests,
    fishing_spot_id: keepLegacyGlobalPlan ? null : input.fishingSpotId,
    is_visible: input.isVisible ?? true,
    is_accepting_reservations: input.isAcceptingReservations ?? true,
  };
}

export async function createAdminPlan(
  profile: Pick<Profile, "role" | "id">,
  input: AdminPlanFormInput,
): Promise<ServiceResult<Plan>> {
  const context = await buildPlanMutationContext(profile);

  if (isBusinessAdminRole(profile.role) && !input.fishingSpotId) {
    return { ok: false, error: "対象釣り場は必須です。", status: 422 };
  }

  const spotCheck = await assertCanManageSpotForPlan(context, input.fishingSpotId);
  if (!spotCheck.ok) {
    return spotCheck;
  }

  try {
    const plan = await insertPlan(toInsertInput(input, generatePlanSlug(input.name)));
    revalidatePath("/admin/plans");
    return { ok: true, data: plan };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "プランの作成に失敗しました。",
      status: 500,
    };
  }
}

export async function updateAdminPlan(
  profile: Pick<Profile, "role" | "id">,
  planId: string,
  input: AdminPlanFormInput,
): Promise<ServiceResult<Plan>> {
  const context = await buildPlanMutationContext(profile);

  const access = await assertCanManageExistingPlan(context, planId);
  if (!access.ok) {
    return access;
  }

  if (access.data.spotId != null) {
    const spotCheck = await assertCanManageSpotForPlan(context, input.fishingSpotId);
    if (!spotCheck.ok) {
      return spotCheck;
    }
  }

  try {
    const plan = await updatePlanById(
      planId,
      toUpdateInput(input, access.data.spotId, profile.role),
    );
    revalidatePath("/admin/plans");
    revalidatePath(`/admin/plans/${planId}/edit`);
    return { ok: true, data: plan };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "プランの更新に失敗しました。",
      status: 500,
    };
  }
}

export async function toggleAdminPlanVisibility(
  profile: Pick<Profile, "role" | "id">,
  planId: string,
  isVisible: boolean,
): Promise<ServiceResult<Plan>> {
  const context = await buildPlanMutationContext(profile);
  const access = await assertCanManageExistingPlan(context, planId);
  if (!access.ok) {
    return access;
  }

  try {
    const plan = await updatePlanVisibilityById(planId, isVisible);
    revalidatePath("/admin/plans");
    return { ok: true, data: plan };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "表示設定の更新に失敗しました。",
      status: 500,
    };
  }
}

export async function toggleAdminPlanAcceptingReservations(
  profile: Pick<Profile, "role" | "id">,
  planId: string,
  isAcceptingReservations: boolean,
): Promise<ServiceResult<Plan>> {
  const context = await buildPlanMutationContext(profile);
  const access = await assertCanManageExistingPlan(context, planId);
  if (!access.ok) {
    return access;
  }

  try {
    const plan = await updatePlanAcceptingReservationsById(planId, isAcceptingReservations);
    revalidatePath("/admin/plans");
    return { ok: true, data: plan };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "予約受付設定の更新に失敗しました。",
      status: 500,
    };
  }
}

export async function getAdminPlanForEdit(
  profile: Pick<Profile, "role" | "id">,
  planId: string,
): Promise<ServiceResult<Awaited<ReturnType<typeof findAdminPlanById>>>> {
  const context = await buildPlanMutationContext(profile);
  const access = await assertCanManageExistingPlan(context, planId);
  if (!access.ok) {
    return access;
  }

  try {
    const plan = await findAdminPlanById(planId);
    if (!plan) {
      return { ok: false, error: "プランが見つかりません。", status: 404 };
    }
    return { ok: true, data: plan };
  } catch {
    return { ok: false, error: "プラン情報の取得に失敗しました。", status: 500 };
  }
}

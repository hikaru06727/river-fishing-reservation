import { createClient } from "@/lib/supabase/server";
import { resolveBookablePlansForSpot, validatePlanForReservation } from "@/lib/plans/plan-reservation-rules";
import type { Plan } from "@/types/database";

export type AdminPlanRow = Plan & {
  locations: {
    name: string;
    business_id: string | null;
  } | null;
};

export type AdminPlanFilters = {
  spotId?: string;
  businessId?: string;
};

const ADMIN_PLAN_SELECT = `
  *,
  locations ( name, business_id )
`;

export async function findActivePlanById(planId: string): Promise<Plan | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function findActivePlanBySlug(slug: string): Promise<Plan | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function findAllActivePlans(): Promise<Plan[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("duration_minutes", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

const BOOKABLE_PLAN_SELECT = "*";

async function findSpotSpecificBookablePlansBySpotId(spotId: string): Promise<Plan[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .select(BOOKABLE_PLAN_SELECT)
    .eq("location_id", spotId)
    .eq("is_active", true)
    .eq("is_visible", true)
    .eq("is_accepting_reservations", true)
    .order("duration_minutes", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function findLegacyBookablePlans(): Promise<Plan[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .select(BOOKABLE_PLAN_SELECT)
    .is("location_id", null)
    .eq("is_active", true)
    .eq("is_visible", true)
    .eq("is_accepting_reservations", true)
    .order("duration_minutes", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

/** 予約 UI 用: spot 別プラン優先、なければ legacy 共通プラン */
export async function findBookablePlansBySpotId(spotId: string): Promise<Plan[]> {
  const [spotPlans, legacyPlans] = await Promise.all([
    findSpotSpecificBookablePlansBySpotId(spotId),
    findLegacyBookablePlans(),
  ]);

  return resolveBookablePlansForSpot(spotPlans, legacyPlans);
}

/** spot 別 bookable プランが存在するか（legacy 許可判定用） */
export async function hasSpotSpecificBookablePlans(spotId: string): Promise<boolean> {
  const spotPlans = await findSpotSpecificBookablePlansBySpotId(spotId);
  return spotPlans.length > 0;
}

/** 予約作成・スロット API 用: planId + spotId の整合性を含めて取得 */
export async function findActivePlanForReservation(
  planId: string,
  spotId: string,
): Promise<Plan | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("plans").select(BOOKABLE_PLAN_SELECT).eq("id", planId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const hasSpotPlans = await hasSpotSpecificBookablePlans(spotId);
  const validation = validatePlanForReservation(data, spotId, hasSpotPlans);
  return validation.ok ? validation.plan : null;
}

/** 予約ページ用: slug + spotId で bookable プランを取得 */
export async function findActivePlanBySlugForSpot(
  slug: string,
  spotId: string,
): Promise<Plan | null> {
  const bookablePlans = await findBookablePlansBySpotId(spotId);
  return bookablePlans.find((plan) => plan.slug === slug) ?? null;
}

export async function findPlanById(planId: string): Promise<Plan | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** 管理画面プラン一覧（RLS 下） */
export async function findAdminPlans(
  filters: AdminPlanFilters = {},
): Promise<AdminPlanRow[]> {
  const supabase = await createClient();

  const select =
    filters.businessId != null
      ? `*, locations!inner ( name, business_id )`
      : ADMIN_PLAN_SELECT;

  let query = supabase.from("plans").select(select).order("created_at", { ascending: false });

  if (filters.spotId) {
    query = query.eq("location_id", filters.spotId);
  }

  if (filters.businessId) {
    query = query.eq("locations.business_id", filters.businessId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AdminPlanRow[];
}

/** 管理画面プラン詳細（RLS 下） */
export async function findAdminPlanById(planId: string): Promise<AdminPlanRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .select(ADMIN_PLAN_SELECT)
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AdminPlanRow | null;
}

export type InsertPlanInput = {
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  price_yen: number;
  max_guests: number;
  location_id: string;
  is_visible: boolean;
  is_accepting_reservations: boolean;
};

export async function insertPlan(input: InsertPlanInput): Promise<Plan> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description,
      duration_minutes: input.duration_minutes,
      price_yen: input.price_yen,
      max_guests: input.max_guests,
      location_id: input.location_id,
      is_visible: input.is_visible,
      is_accepting_reservations: input.is_accepting_reservations,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export type UpdatePlanInput = {
  name: string;
  description: string | null;
  duration_minutes: number;
  price_yen: number;
  max_guests: number;
  location_id: string | null;
  is_visible: boolean;
  is_accepting_reservations: boolean;
};

export async function updatePlanById(
  planId: string,
  input: UpdatePlanInput,
): Promise<Plan> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .update({
      name: input.name,
      description: input.description,
      duration_minutes: input.duration_minutes,
      price_yen: input.price_yen,
      max_guests: input.max_guests,
      location_id: input.location_id,
      is_visible: input.is_visible,
      is_accepting_reservations: input.is_accepting_reservations,
    })
    .eq("id", planId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updatePlanVisibilityById(
  planId: string,
  isVisible: boolean,
): Promise<Plan> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .update({ is_visible: isVisible })
    .eq("id", planId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updatePlanAcceptingReservationsById(
  planId: string,
  isAcceptingReservations: boolean,
): Promise<Plan> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .update({ is_accepting_reservations: isAcceptingReservations })
    .eq("id", planId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function findPlanSpotIdByPlanId(planId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plans")
    .select("location_id")
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.location_id ?? null;
}

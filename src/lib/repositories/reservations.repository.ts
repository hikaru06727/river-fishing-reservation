import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getReservationPlanDisplay } from "@/lib/reservations/plan-display";
import type { PaymentMethod, PaymentStatus, Reservation, ReservationStatus } from "@/types/database";

export type ReservationInsert = {
  user_id: string;
  spot_id: string;
  plan_id: string;
  slot_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  total_amount_yen: number;
  status: ReservationStatus;
  payment_method: PaymentMethod;
  expires_at: string | null;
};

export type AtomicReservationRpcResult = {
  reservation_id: string | null;
  success: boolean;
  error_code: string | null;
  error_message: string | null;
};

export type CreateReservationAtomicInput = ReservationInsert & {
  affected_slot_ids: string[];
};

export type CancelReservationAtomicInput = {
  reservation_id: string;
  user_id: string;
  affected_slot_ids: string[];
  guest_count: number;
};

function firstRpcRow(data: AtomicReservationRpcResult[] | null): AtomicReservationRpcResult | null {
  return data?.[0] ?? null;
}

/**
 * 予約作成 + スロット更新を DB トランザクション（RPC）で原子的に実行。
 * 同時実行時は FOR UPDATE 行ロック + 容量再検証でダブルブッキングを防ぐ。
 */
export async function createReservationAtomic(
  input: CreateReservationAtomicInput,
): Promise<AtomicReservationRpcResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("create_reservation_atomic", {
    p_user_id: input.user_id,
    p_spot_id: input.spot_id,
    p_plan_id: input.plan_id,
    p_slot_id: input.slot_id,
    p_reservation_date: input.reservation_date,
    p_start_time: input.start_time,
    p_end_time: input.end_time,
    p_guest_count: input.guest_count,
    p_total_amount_yen: input.total_amount_yen,
    p_expires_at: input.expires_at as string | null as string,
    p_affected_slot_ids: input.affected_slot_ids,
    p_payment_method: input.payment_method,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = firstRpcRow(data as AtomicReservationRpcResult[] | null);
  if (!row) {
    throw new Error("予約 RPC が結果を返しませんでした");
  }

  return row;
}

export type ReservationPlanSnapshot = {
  reserved_plan_name: string;
  reserved_unit_price_yen: number;
  reserved_duration_minutes: number;
  tax_rate_percent?: number | null;
};

/** 予約作成後に plan snapshot を保存（Phase 8c: post-RPC UPDATE） */
export async function updateReservationPlanSnapshot(
  reservationId: string,
  snapshot: ReservationPlanSnapshot,
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("reservations")
    .update(snapshot)
    .eq("id", reservationId);

  if (error) {
    throw new Error(error.message);
  }
}

/** 現金精算予約: 決済待ちレコードを service_role で作成 */
export async function insertPendingPaymentForReservation(
  reservationId: string,
  amountYen: number,
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from("payments").insert({
    reservation_id: reservationId,
    amount_yen: amountYen,
    currency: "jpy",
    status: "pending",
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * 予約キャンセル + スロット更新を DB トランザクション（RPC）で原子的に実行。
 */
export async function cancelReservationAtomic(
  input: CancelReservationAtomicInput,
): Promise<AtomicReservationRpcResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("cancel_reservation_atomic", {
    p_reservation_id: input.reservation_id,
    p_user_id: input.user_id,
    p_affected_slot_ids: input.affected_slot_ids,
    p_guest_count: input.guest_count,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = firstRpcRow(data as AtomicReservationRpcResult[] | null);
  if (!row) {
    throw new Error("キャンセル RPC が結果を返しませんでした");
  }

  return row;
}

/** @deprecated createReservationAtomic を使用すること */
export async function insertReservation(
  input: ReservationInsert,
): Promise<Pick<Reservation, "id" | "status" | "slot_id" | "guest_count">> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .insert(input)
    .select("id, status, slot_id, guest_count")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** @deprecated createReservationAtomic 失敗時のロールバック専用。通常フローでは不要 */
export async function deleteReservationById(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("reservations").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function findReservationByIdForUser(
  id: string,
  userId: string,
): Promise<Reservation | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function findReservationByIdAdmin(id: string): Promise<Reservation | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** @deprecated cancelReservationAtomic を使用すること */
export async function updateReservationStatus(
  id: string,
  userId: string,
  status: ReservationStatus,
  allowedCurrentStatuses?: ReservationStatus[],
): Promise<Reservation | null> {
  const supabase = await createClient();

  let query = supabase
    .from("reservations")
    .update({ status })
    .eq("id", id)
    .eq("user_id", userId);

  if (allowedCurrentStatuses?.length) {
    query = query.in("status", allowedCurrentStatuses);
  }

  const { data, error } = await query.select("*").maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export type SpotNotificationMeta = {
  slug: string;
  name: string;
  businessId: string | null;
};

export async function findSpotNotificationMetaById(
  spotId: string,
): Promise<SpotNotificationMeta | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("locations")
    .select("slug, name, business_id")
    .eq("id", spotId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    slug: data.slug,
    name: data.name,
    businessId: data.business_id,
  };
}

/** @deprecated findSpotNotificationMetaById を使用すること */
export async function findSpotSlugById(spotId: string): Promise<string | null> {
  const meta = await findSpotNotificationMetaById(spotId);
  return meta?.slug ?? null;
}

export type ReservationCompleteDisplayRow = {
  total_amount_yen: number;
  reservation_date: string;
  start_time: string;
  planName: string | null;
};

/** 決済完了画面表示用（service_role・Stripe metadata と突合） */
export async function findReservationCompleteDisplayByIdAdmin(
  reservationId: string,
  userId: string,
): Promise<ReservationCompleteDisplayRow | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservations")
    .select(
      "total_amount_yen, reservation_date, start_time, reserved_plan_name, plans(name)",
    )
    .eq("id", reservationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const plans = data.plans as unknown as { name: string } | null;

  return {
    total_amount_yen: data.total_amount_yen,
    reservation_date: data.reservation_date,
    start_time: data.start_time,
    planName: getReservationPlanDisplay(
      { reserved_plan_name: data.reserved_plan_name, plans },
      { nameFallback: "プラン" },
    ).name,
  };
}

export type ReservationPaymentEmailMeta = {
  reservationId: string;
  userId: string;
  spotName: string;
  businessId: string | null;
  planName: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  totalAmountYen: number;
};

export async function findReservationPaymentEmailMetaById(
  reservationId: string,
  userId: string,
): Promise<ReservationPaymentEmailMeta | null> {
  const admin = createAdminClient();

  const { data: reservation, error } = await admin
    .from("reservations")
    .select(
      "id, user_id, spot_id, plan_id, reservation_date, start_time, end_time, guest_count, total_amount_yen, reserved_plan_name",
    )
    .eq("id", reservationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!reservation) {
    return null;
  }

  const spotMeta = await findSpotNotificationMetaById(reservation.spot_id);

  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("name")
    .eq("id", reservation.plan_id)
    .maybeSingle();

  if (planError) {
    throw new Error(planError.message);
  }

  return {
    reservationId: reservation.id,
    userId: reservation.user_id,
    spotName: spotMeta?.name ?? "釣り場",
    businessId: spotMeta?.businessId ?? null,
    planName: getReservationPlanDisplay(
      { reserved_plan_name: reservation.reserved_plan_name, plans: plan },
      { nameFallback: "プラン" },
    ).name,
    reservationDate: reservation.reservation_date,
    startTime: reservation.start_time,
    endTime: reservation.end_time,
    guestCount: reservation.guest_count,
    totalAmountYen: reservation.total_amount_yen,
  };
}

// ---------------------------------------------------------------------------
// Read queries（get-reservation / get-my-reservations / get-admin-reservations）
// ---------------------------------------------------------------------------

const RESERVATION_DETAIL_SELECT = `
  *,
  locations ( name, slug ),
  plans ( name, slug, duration_minutes, price_yen ),
  payments ( status )
`;

const MY_RESERVATIONS_SELECT = `
  *,
  locations ( name, slug ),
  plans ( name, slug ),
  payments ( status )
`;

export const ADMIN_RESERVATION_LIST_SELECT = `
  id,
  payment_method,
  reservation_date,
  start_time,
  end_time,
  guest_count,
  status,
  total_amount_yen,
  reserved_plan_name,
  reserved_unit_price_yen,
  reserved_duration_minutes,
  created_at,
  updated_at,
  expires_at,
  stripe_checkout_session_id,
  plans ( name ),
  profiles ( full_name, email ),
  locations ( name, slug, business_id ),
  payments ( status, amount_yen, paid_at, created_at )
`;

const ADMIN_RESERVATION_DETAIL_SELECT = `
  *,
  plans ( name ),
  profiles ( full_name, email ),
  locations ( name, slug, business_id ),
  payments ( status, amount_yen, paid_at, created_at, stripe_payment_intent_id, stripe_checkout_session_id )
`;

export type ReservationDetailRow = Reservation & {
  payment_method?: PaymentMethod | null;
  locations: { name: string; slug: string } | null;
  plans: { name: string; slug: string; duration_minutes: number; price_yen: number } | null;
  payments: Array<{ status: PaymentStatus }> | null;
};

export type MyReservationRow = Reservation & {
  payment_method?: PaymentMethod | null;
  locations: { name: string; slug: string } | null;
  plans: { name: string; slug: string } | null;
  payments: Array<{ status: PaymentStatus }> | null;
};

/** ユーザー向け予約詳細（JOIN 付き・RLS 下） */
export async function findReservationDetailByIdForUser(
  id: string,
  userId: string,
): Promise<ReservationDetailRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_DETAIL_SELECT)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as ReservationDetailRow | null;
}

/** マイ予約一覧（JOIN 付き・RLS 下） */
export async function findMyReservationsByUserId(
  userId: string,
): Promise<MyReservationRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(MY_RESERVATIONS_SELECT)
    .eq("user_id", userId)
    .order("reservation_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as MyReservationRow[];
}

export type AdminReservationsQueryFilters = {
  singleDate?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: ReservationStatus;
  spotId?: string;
  from: number;
  to: number;
};

export type AdminReservationsQueryResult = {
  rows: unknown[];
  totalCount: number;
};

/** 管理画面予約一覧（ページネーション・RLS 下） */
export async function findAdminReservationsPaginated(
  filters: AdminReservationsQueryFilters,
): Promise<AdminReservationsQueryResult> {
  const supabase = await createClient();

  let query = supabase
    .from("reservations")
    .select(ADMIN_RESERVATION_LIST_SELECT, { count: "exact" })
    .order("reservation_date", { ascending: false })
    .order("start_time", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.singleDate) {
    query = query.eq("reservation_date", filters.singleDate);
  } else {
    if (filters.dateFrom) {
      query = query.gte("reservation_date", filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte("reservation_date", filters.dateTo);
    }
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.spotId) {
    query = query.eq("spot_id", filters.spotId);
  }

  const { data, error, count } = await query.range(filters.from, filters.to);

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: data ?? [],
    totalCount: count ?? 0,
  };
}

/** 管理画面予約詳細（JOIN 付き・RLS 下） */
export async function findAdminReservationDetailById(
  id: string,
): Promise<unknown | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(ADMIN_RESERVATION_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export type TodaySummaryRow = {
  guest_count: number;
  total_amount_yen: number;
  status: ReservationStatus;
};

/** 本日サマリー用の予約行 */
export async function findTodayReservationSummaryRows(
  today: string,
): Promise<TodaySummaryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select("guest_count, total_amount_yen, status")
    .eq("reservation_date", today)
    .in("status", ["pending", "confirmed"]);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TodaySummaryRow[];
}

/** ステータス別件数集計用 */
export async function findAllReservationStatuses(): Promise<ReservationStatus[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("reservations").select("status");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.status as ReservationStatus);
}

/** 直近予約一覧（管理ダッシュボード） */
export async function findRecentAdminReservations(
  limit: number,
): Promise<unknown[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(ADMIN_RESERVATION_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

/** 本日の予約件数 */
export async function countReservationsByDate(today: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("reservation_date", today);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Stripe checkout / webhook（service_role）
// ---------------------------------------------------------------------------

/** Checkout 後に stripe_checkout_session_id を記録 */
export async function updateReservationStripeCheckoutSessionId(
  reservationId: string,
  userId: string,
  stripeCheckoutSessionId: string,
): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("reservations")
    .update({ stripe_checkout_session_id: stripeCheckoutSessionId })
    .eq("id", reservationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export type StripeWebhookReservationRow = {
  id: string;
  user_id: string;
  status: ReservationStatus;
  total_amount_yen: number;
  payment_method: PaymentMethod;
};

/** Stripe webhook: 確認対象の予約を取得 */
export async function findReservationForStripeWebhook(
  reservationId: string,
  userId: string,
): Promise<StripeWebhookReservationRow | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservations")
    .select("id, user_id, status, total_amount_yen, payment_method")
    .eq("id", reservationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    user_id: data.user_id,
    status: data.status as ReservationStatus,
    total_amount_yen: data.total_amount_yen,
    payment_method: data.payment_method as PaymentMethod,
  };
}

/** Stripe webhook: pending → confirmed（条件付き更新） */
export async function confirmPendingReservationFromStripeWebhook(input: {
  reservationId: string;
  userId: string;
  stripeCheckoutSessionId: string;
}): Promise<{ updatedCount: number }> {
  const admin = createAdminClient();

  const { data: updatedRows, error } = await admin
    .from("reservations")
    .update({
      status: "confirmed",
      stripe_checkout_session_id: input.stripeCheckoutSessionId,
    })
    .eq("id", input.reservationId)
    .eq("user_id", input.userId)
    .eq("status", "pending")
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return { updatedCount: updatedRows?.length ?? 0 };
}

/** Stripe webhook: 同時更新時の現在ステータス取得 */
export async function findReservationStatusForStripeWebhook(
  reservationId: string,
  userId: string,
): Promise<ReservationStatus | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservations")
    .select("status")
    .eq("id", reservationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.status as ReservationStatus | undefined) ?? null;
}

export type ExpirePendingReservationsRpcResult = {
  expired_count: number;
  reservation_ids: string[];
};

/** DB の expire_pending_reservations RPC を実行（online pending のみ失効） */
export async function expirePendingReservationsRpc(): Promise<ExpirePendingReservationsRpcResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("expire_pending_reservations");

  if (error) {
    throw new Error(error.message);
  }

  const row = (data as ExpirePendingReservationsRpcResult[] | null)?.[0];
  return {
    expired_count: row?.expired_count ?? 0,
    reservation_ids: row?.reservation_ids ?? [],
  };
}

export type ExpiredReservationEmailRow = {
  id: string;
  user_id: string;
  spot_id: string;
  plan_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  payment_method: PaymentMethod;
  spotName: string;
  planName: string;
};

/**
 * 期限切れメール未送信の expired online 予約を取得。
 * pg_cron が先に expired にした予約も対象（expired_email_sent_at IS NULL）。
 */
export async function findExpiredReservationsPendingEmail(): Promise<ExpiredReservationEmailRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservations")
    .select(
      "id, user_id, spot_id, plan_id, reservation_date, start_time, end_time, guest_count, payment_method, reserved_plan_name",
    )
    .eq("status", "expired")
    .eq("payment_method", "online")
    .is("expired_email_sent_at", null)
    .order("updated_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const results: ExpiredReservationEmailRow[] = [];

  for (const row of rows) {
    const spotMeta = await findSpotNotificationMetaById(row.spot_id);

    let plansJoin: { name: string } | null = null;
    if (!row.reserved_plan_name) {
      const { data: plan, error: planError } = await admin
        .from("plans")
        .select("name")
        .eq("id", row.plan_id)
        .maybeSingle();

      if (planError) {
        throw new Error(planError.message);
      }

      plansJoin = plan;
    }

    const planName = getReservationPlanDisplay(
      { reserved_plan_name: row.reserved_plan_name, plans: plansJoin },
      { nameFallback: "プラン" },
    ).name;

    results.push({
      id: row.id,
      user_id: row.user_id,
      spot_id: row.spot_id,
      plan_id: row.plan_id,
      reservation_date: row.reservation_date,
      start_time: row.start_time,
      end_time: row.end_time,
      guest_count: row.guest_count,
      payment_method: row.payment_method as PaymentMethod,
      spotName: spotMeta?.name ?? "釣り場",
      planName,
    });
  }

  return results;
}

/** 期限切れメール送信済みを記録（未送信行のみ更新して二重送信を防ぐ） */
export async function markExpiredEmailSent(reservationId: string): Promise<boolean> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("reservations")
    .update({ expired_email_sent_at: now })
    .eq("id", reservationId)
    .is("expired_email_sent_at", null)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return (data?.length ?? 0) > 0;
}

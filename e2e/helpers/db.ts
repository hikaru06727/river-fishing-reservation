import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { Database } from "@/types/database";

/**
 * Playwright テストは Next.js ランタイムではなく素の Node プロセスで動くため、
 * グローバル WebSocket が無く @supabase/supabase-js の realtime クライアント初期化が
 * 例外を投げる（Node 20 では process.loadEnvFile 同様に未対応）。ws を明示的に渡して回避する。
 * src/lib/supabase/admin.ts の createAdminClient() は Next.js ランタイム専用なのでここでは使わない。
 */
function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: WebSocket as never },
    },
  );
}

/**
 * Stripe Webhook や管理操作の反映は非同期なので、DB/外部APIの確認は
 * 全てこの waitFor 経由で行い flaky にならないようにする。
 */
export async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  options: { timeoutMs?: number; intervalMs?: number; description: string },
): Promise<T> {
  const { timeoutMs = 20_000, intervalMs = 1_000, description } = options;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const suffix = lastError instanceof Error ? ` last error: ${lastError.message}` : "";
  throw new Error(`[waitFor] timed out after ${timeoutMs}ms waiting for: ${description}.${suffix}`);
}

export async function getProductStock(productId: string): Promise<number | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("stock_quantity")
    .eq("id", productId)
    .single();

  if (error) throw new Error(`[getProductStock] ${error.message}`);
  return data.stock_quantity;
}

export async function getProductName(productId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("name")
    .eq("id", productId)
    .single();

  if (error) throw new Error(`[getProductName] ${error.message}`);
  return data.name;
}

export async function getReservationStatus(reservationId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("status")
    .eq("id", reservationId)
    .single();

  if (error) throw new Error(`[getReservationStatus] ${error.message}`);
  return data.status;
}

export type PaymentLedgerRow = {
  id: string;
  source_type: string;
  source_id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  paid_at: string | null;
};

export async function getPaymentLedgerRows(
  sourceType: "reservation" | "reservation_addon",
  sourceId: string,
): Promise<PaymentLedgerRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_ledger")
    .select("id, source_type, source_id, amount, status, payment_method, paid_at")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  if (error) throw new Error(`[getPaymentLedgerRows] ${error.message}`);
  return data ?? [];
}

export type ReservationAddonItemRow = {
  id: string;
  reservation_id: string;
  product_id: string;
  quantity: number;
  status: string;
  stock_decremented_at: string | null;
};

export async function getReservationAddonItems(
  reservationId: string,
): Promise<ReservationAddonItemRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reservation_addon_items")
    .select("id, reservation_id, product_id, quantity, status, stock_decremented_at")
    .eq("reservation_id", reservationId);

  if (error) throw new Error(`[getReservationAddonItems] ${error.message}`);
  return data ?? [];
}

export type SaleRefundRow = {
  id: string;
  reservation_id: string | null;
  refunded_by: string;
  stripe_refund_id: string | null;
  amount: number;
  status: string;
};

export async function getSaleRefunds(reservationId: string): Promise<SaleRefundRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sale_refunds")
    .select("id, reservation_id, refunded_by, stripe_refund_id, amount, status")
    .eq("reservation_id", reservationId);

  if (error) throw new Error(`[getSaleRefunds] ${error.message}`);
  return data ?? [];
}

export type OnlineOrderRow = {
  id: string;
  business_id: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  linked_reservation_id: string | null;
  confirmation_code: string | null;
  stripe_payment_intent_id: string | null;
};

const ONLINE_ORDER_SELECT =
  "id, business_id, status, payment_status, payment_method, total_amount, linked_reservation_id, confirmation_code, stripe_payment_intent_id";

/** 予約に紐づく追加購入注文一覧（Phase 19E） */
export async function getOnlineOrdersByLinkedReservationId(
  reservationId: string,
): Promise<OnlineOrderRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("online_orders")
    .select(ONLINE_ORDER_SELECT)
    .eq("linked_reservation_id", reservationId);

  if (error) throw new Error(`[getOnlineOrdersByLinkedReservationId] ${error.message}`);
  return data ?? [];
}

export async function getOnlineOrderById(orderId: string): Promise<OnlineOrderRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("online_orders")
    .select(ONLINE_ORDER_SELECT)
    .eq("id", orderId)
    .single();

  if (error) throw new Error(`[getOnlineOrderById] ${error.message}`);
  return data;
}

export async function getSaleRefundsByOnlineOrderId(orderId: string): Promise<SaleRefundRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sale_refunds")
    .select("id, reservation_id, refunded_by, stripe_refund_id, amount, status")
    .eq("online_order_id", orderId);

  if (error) throw new Error(`[getSaleRefundsByOnlineOrderId] ${error.message}`);
  return data ?? [];
}

/**
 * Phase 20 E2E 用: メール受信を経由せずパスワード付きの確認済みユーザーを作成する。
 * 呼び出し元でテスト終了時に必ず deleteTestUser() で後始末すること。
 */
export async function createConfirmedTestUser(email: string, password: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`[createConfirmedTestUser] ${error?.message ?? "user is null"}`);
  }
  return data.user.id;
}

export async function deleteTestUser(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw new Error(`[deleteTestUser] ${error.message}`);
}

export async function getAuthUserEmailConfirmedAt(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) {
    throw new Error(`[getAuthUserEmailConfirmedAt] ${error?.message ?? "user is null"}`);
  }
  return data.user.email_confirmed_at ?? null;
}

export type ProfileAddressRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  postal_code: string | null;
  prefecture: string | null;
  address_line1: string | null;
  address_line2: string | null;
};

export async function getProfileByEmail(email: string): Promise<ProfileAddressRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, postal_code, prefecture, address_line1, address_line2")
    .eq("email", email)
    .maybeSingle();

  if (error) throw new Error(`[getProfileByEmail] ${error.message}`);
  return data;
}

export async function findBusinessIdForSpot(spotId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("locations")
    .select("business_id")
    .eq("id", spotId)
    .single();

  if (error || !data.business_id) {
    throw new Error(`[findBusinessIdForSpot] ${error?.message ?? "business_id is null"}`);
  }
  return data.business_id;
}

/** 「他人の注文」RLS 検証用に、任意の user_id で最小限の online_order 行を作成する（Phase 20）。 */
export async function insertOnlineOrderForUser(userId: string, businessId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("online_orders")
    .insert({
      business_id: businessId,
      user_id: userId,
      fulfillment_type: "pickup",
      payment_method: "in_person",
      subtotal_amount: 1000,
      tax_amount: 100,
      total_amount: 1100,
      customer_name: "E2E 他人テスト",
      customer_email: "e2e-other-user@example.com",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`[insertOnlineOrderForUser] ${error?.message ?? "insert returned no data"}`);
  }
  return data.id;
}

export async function getSystemProfileId(): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_system", true)
    .single();

  if (error) {
    throw new Error(
      `[getSystemProfileId] ${error.message} — scripts/setup-system-profile.mjs が未実行の可能性があります`,
    );
  }
  return data.id;
}

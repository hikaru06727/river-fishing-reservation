import { createClient } from "@/lib/supabase/server";
import type {
  SaleSessionDetail,
  SaleSessionItemDetail,
  SaleSessionListRow,
} from "@/lib/sales/sale-session-types";
import type { PosPaymentMethod, SaleSession, SaleSessionDiscount, SaleSessionItem } from "@/types/database";

export type InsertSaleSessionInput = {
  business_id: string;
  payment_method: PosPaymentMethod;
  payment_other_label?: string | null;
  tax_rate_percent: number;
  subtotal_amount: number;
  discount_amount?: number;
  tax_amount: number;
  total_amount: number;
  note?: string | null;
  created_by: string;
  sold_at?: string;
};

export type InsertSaleSessionItemInput = {
  sale_session_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_rate_percent?: number;
};

export type InsertSaleSessionDiscountInput = {
  sale_session_id: string;
  discount_type: "amount" | "rate";
  target: "item" | "session";
  target_item_id?: string | null;
  discount_value: number;
  discount_amount: number;
  note?: string | null;
};

const SALE_SESSION_LIST_SELECT = `
  id,
  business_id,
  sold_at,
  payment_method,
  payment_other_label,
  tax_rate_percent,
  subtotal_amount,
  discount_amount,
  tax_amount,
  total_amount,
  note,
  created_by,
  created_at,
  sale_session_items ( id )
`;

const SALE_SESSION_DETAIL_SELECT = `
  id,
  business_id,
  sold_at,
  payment_method,
  payment_other_label,
  tax_rate_percent,
  subtotal_amount,
  discount_amount,
  tax_amount,
  total_amount,
  note,
  created_by,
  created_at,
  sale_session_items (
    id,
    sale_session_id,
    product_id,
    quantity,
    unit_price,
    subtotal,
    tax_rate_percent,
    created_at,
    products ( name )
  ),
  sale_session_discounts (
    id,
    discount_type,
    target,
    target_item_id,
    discount_value,
    discount_amount,
    note,
    created_at
  )
`;

type SaleSessionListDbRow = SaleSession & {
  sale_session_items: Array<{ id: string }> | null;
};

type SaleSessionItemDbRow = SaleSessionItem & {
  products: { name: string } | Array<{ name: string }> | null;
};

type SaleSessionDetailDbRow = SaleSession & {
  sale_session_items: SaleSessionItemDbRow[] | null;
  sale_session_discounts: SaleSessionDiscount[] | null;
};

function resolveProductName(
  products: SaleSessionItemDbRow["products"],
): string {
  if (products == null) {
    return "（商品名なし）";
  }
  if (Array.isArray(products)) {
    return products[0]?.name ?? "（商品名なし）";
  }
  return products.name ?? "（商品名なし）";
}

function mapSaleSessionListRow(row: SaleSessionListDbRow): SaleSessionListRow {
  const items = row.sale_session_items ?? [];
  const { sale_session_items: _items, ...session } = row;
  return {
    ...session,
    item_count: items.length,
  };
}

function mapSaleSessionDetail(row: SaleSessionDetailDbRow): SaleSessionDetail {
  const { sale_session_items, sale_session_discounts, ...session } = row;
  const items: SaleSessionItemDetail[] = (sale_session_items ?? []).map((item) => {
    const { products, ...rest } = item;
    return {
      ...rest,
      product_name: resolveProductName(products),
    };
  });

  return {
    ...session,
    items,
    discounts: (sale_session_discounts ?? []) as SaleSessionDiscount[],
  };
}

export async function insertSaleSession(input: InsertSaleSessionInput): Promise<SaleSession> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sale_sessions")
    .insert({
      business_id: input.business_id,
      payment_method: input.payment_method,
      payment_other_label: input.payment_other_label ?? null,
      tax_rate_percent: input.tax_rate_percent,
      subtotal_amount: input.subtotal_amount,
      discount_amount: input.discount_amount ?? 0,
      tax_amount: input.tax_amount,
      total_amount: input.total_amount,
      note: input.note ?? null,
      created_by: input.created_by,
      ...(input.sold_at ? { sold_at: input.sold_at } : {}),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SaleSession;
}

export async function insertSaleSessionItems(
  items: InsertSaleSessionItemInput[],
): Promise<SaleSessionItem[]> {
  if (items.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sale_session_items")
    .insert(items.map((i) => ({
      sale_session_id: i.sale_session_id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.subtotal,
      tax_rate_percent: i.tax_rate_percent ?? 10,
    })))
    .select();

  if (error) throw new Error(error.message);
  return (data ?? []) as SaleSessionItem[];
}

export async function deleteSaleSessionById(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("sale_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertSaleSessionDiscounts(
  discounts: InsertSaleSessionDiscountInput[],
): Promise<SaleSessionDiscount[]> {
  if (discounts.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sale_session_discounts")
    .insert(discounts)
    .select();

  if (error) throw new Error(error.message);
  return (data ?? []) as SaleSessionDiscount[];
}

export type SaleSessionListFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  paymentMethod?: string | null;
  onlyUnsettled?: boolean;
};

/** 事業の販売セッション一覧（明細件数付き・RLS 下） */
export async function listByBusiness(
  businessId: string,
  filters: SaleSessionListFilters = {},
): Promise<SaleSessionListRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("sale_sessions")
    .select(SALE_SESSION_LIST_SELECT)
    .eq("business_id", businessId)
    .order("sold_at", { ascending: false });

  if (filters.dateFrom) {
    query = query.gte("sold_at", filters.dateFrom + "T00:00:00+09:00");
  }
  if (filters.dateTo) {
    query = query.lte("sold_at", filters.dateTo + "T23:59:59+09:00");
  }
  if (filters.paymentMethod)
    query = query.eq("payment_method", filters.paymentMethod as SaleSession["payment_method"]);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let sessions = ((data ?? []) as unknown as SaleSessionListDbRow[]).map(mapSaleSessionListRow);

  if (filters.onlyUnsettled && sessions.length > 0) {
    const { data: closingsData, error: closingsError } = await supabase
      .from("register_closings")
      .select("period_start, period_end")
      .eq("business_id", businessId)
      .in("status", ["closed", "correction_requested", "approved"]);

    if (closingsError) throw new Error(closingsError.message);

    const periods = (closingsData ?? []) as Array<{ period_start: string; period_end: string }>;
    if (periods.length > 0) {
      sessions = sessions.filter((s) => {
        const soldAt = new Date(s.sold_at).getTime();
        return !periods.some(
          (p) =>
            soldAt >= new Date(p.period_start).getTime() &&
            soldAt <= new Date(p.period_end).getTime(),
        );
      });
    }
  }

  return sessions;
}

/** 販売セッション詳細（明細・商品名付き・RLS 下） */
export async function getById(id: string): Promise<SaleSessionDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sale_sessions")
    .select(SALE_SESSION_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapSaleSessionDetail(data as unknown as SaleSessionDetailDbRow);
}

/** @deprecated listByBusiness を使用 */
export async function findSaleSessionsByBusinessId(businessId: string): Promise<SaleSession[]> {
  const rows = await listByBusiness(businessId);
  return rows.map(({ item_count: _itemCount, ...session }) => session);
}

/** @deprecated getById を使用 */
export async function findSaleSessionById(id: string): Promise<SaleSession | null> {
  const detail = await getById(id);
  if (!detail) return null;
  const { items: _items, ...session } = detail;
  return session;
}

export async function findSaleSessionItemsBySessionId(
  sessionId: string,
): Promise<SaleSessionItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sale_session_items")
    .select("*")
    .eq("sale_session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SaleSessionItem[];
}

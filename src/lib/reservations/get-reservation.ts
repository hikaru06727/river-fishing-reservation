import { createClient } from "@/lib/supabase/server";
import type { PaymentStatus, Reservation } from "@/types/database";
import type { PaymentMethod } from "@/lib/reservations/payment-method";

export type ReservationDetail = Reservation & {
  payment_method?: PaymentMethod | null;
  fishing_spots: { name: string; slug: string } | null;
  plans: { name: string; slug: string; duration_minutes: number; price_yen: number } | null;
  payments: Array<{ status: PaymentStatus }> | null;
};

export async function getReservationById(
  id: string,
  userId: string,
): Promise<ReservationDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      *,
      fishing_spots ( name, slug ),
      plans ( name, slug, duration_minutes, price_yen ),
      payments ( status )
    `,
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getReservationById]", error.message);
    throw new Error("予約情報の取得に失敗しました。");
  }

  return data as unknown as ReservationDetail | null;
}

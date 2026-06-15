import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { formatDate, formatTime, formatYen } from "@/lib/utils/format";

async function CompleteContent({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  if (!session_id) {
    redirect("/spots");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(session_id);

  if (session.payment_status !== "paid") {
    redirect("/spots");
  }

  const reservationId = session.metadata?.reservationId;
  const userId = session.metadata?.userId;
  const date = session.metadata?.date;
  const time = session.metadata?.time;

  let planName: string | null = null;
  let totalAmount: number | null = session.amount_total;

  if (reservationId && userId) {
    const admin = createAdminClient();
    const { data: reservation } = await admin
      .from("reservations")
      .select("total_amount_yen, reservation_date, start_time, plans(name)")
      .eq("id", reservationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (reservation) {
      const plans = reservation.plans as unknown as { name: string } | null;
      planName = plans?.name ?? null;
      totalAmount = reservation.total_amount_yen;
    }
  }

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="text-5xl" aria-hidden="true">
        🎣
      </div>
      <h1 className="mt-4 text-2xl font-bold">予約が確定しました！</h1>
      <p className="mt-2 text-sm text-muted">確認メールをお送りしております</p>

      <dl className="mt-8 space-y-4 rounded-2xl border border-border p-6 text-left">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">プラン</dt>
          <dd className="font-medium">{planName ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">日付</dt>
          <dd className="font-medium">{date ? formatDate(date) : "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">開始時間</dt>
          <dd className="font-medium">{time ? formatTime(time) : "—"}</dd>
        </div>
        {totalAmount != null && (
          <div className="flex justify-between gap-4 border-t border-border pt-4">
            <dt className="font-semibold">合計</dt>
            <dd className="text-xl font-bold text-primary">{formatYen(totalAmount)}</dd>
          </div>
        )}
      </dl>

      <Link
        href="/my/reservations"
        className="mt-8 inline-flex min-h-12 items-center rounded-full bg-primary px-8 font-semibold text-primary-foreground hover:opacity-90"
      >
        予約一覧を確認する
      </Link>
    </div>
  );
}

export default function CompletePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  return (
    <Suspense fallback={<div className="py-8 text-center text-muted">確認中...</div>}>
      <CompleteContent searchParams={searchParams} />
    </Suspense>
  );
}

"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createReservationAction } from "@/actions/reservation";
import { createReservationInitialState } from "@/types/reservation-action";
import { PaymentMethodSelector } from "@/components/reservation/PaymentMethodSelector";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAvailableSlotsWithPlan } from "@/hooks/use-available-slots-with-plan";
import { getUniqueSlotDates } from "@/lib/slots/group-slots-by-date";
import type { PaymentMethod } from "@/lib/reservations/payment-method";
import type { SpotSummary } from "@/lib/spots/get-spot-by-id";
import { formatDate, formatTime, formatYen, cn } from "@/lib/utils/format";
import { formatDuration } from "@/lib/utils/plan";
import type { Plan } from "@/types/database";

interface ReserveFormProps {
  spot: SpotSummary;
  plan: Plan;
}

export function ReserveForm({ spot, plan }: ReserveFormProps) {
  const [state, formAction, pending] = useActionState(
    createReservationAction,
    createReservationInitialState,
  );

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");

  const { data, loading, error } = useAvailableSlotsWithPlan({
    spotId: spot.id,
    planId: plan.id,
    guestCount,
  });

  const slots = data?.slots ?? [];
  const planInfo = data?.plan ?? plan;

  const availableDates = useMemo(() => getUniqueSlotDates(slots), [slots]);

  useEffect(() => {
    if (availableDates.length === 0) {
      setSelectedDate("");
      setSelectedSlotId("");
      return;
    }

    if (!selectedDate || !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0]!);
      setSelectedSlotId("");
    }
  }, [availableDates, selectedDate]);

  const slotsForDate = useMemo(
    () => slots.filter((s) => s.date === selectedDate),
    [slots, selectedDate],
  );

  const selectedSlot = slotsForDate.find((s) => s.id === selectedSlotId);
  // remaining_count は API が返す値のみ使用（再計算禁止）
  const maxGuests = selectedSlot?.remaining_count ?? 1;
  const totalAmount = planInfo.price_yen * guestCount;

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setSelectedSlotId("");
    setGuestCount(1);
  }

  function handleSlotChange(slotId: string) {
    setSelectedSlotId(slotId);
    const slot = slots.find((s) => s.id === slotId);
    if (slot && guestCount > slot.remaining_count) {
      setGuestCount(slot.remaining_count);
    }
  }

  if (loading && !data) {
    return (
      <Card className="text-center">
        <p className="text-sm text-muted">空き枠を読み込み中...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="text-center">
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
        <Link
          href={`/spots/${spot.slug}`}
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          釣り場詳細に戻る
        </Link>
      </Card>
    );
  }

  if (slots.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-4xl" aria-hidden="true">
          📅
        </p>
        <p className="mt-3 font-medium">予約可能な空き枠がありません</p>
        <Link
          href={`/spots/${spot.slug}`}
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          釣り場詳細に戻る
        </Link>
      </Card>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="spotId" value={spot.id} />
      <input type="hidden" name="planId" value={plan.id} />

      <Card>
        <h2 className="text-sm font-medium text-muted">予約内容</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">釣り場</dt>
            <dd className="font-semibold">{spot.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">プラン</dt>
            <dd className="font-semibold">{planInfo.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">利用時間</dt>
            <dd>{formatDuration(planInfo.duration_minutes)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="text-muted">利用料金（1名）</dt>
            <dd className="text-lg font-bold text-primary">
              {formatYen(planInfo.price_yen)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold">予約情報入力</h2>

        <div className="space-y-5">
          <div>
            <label htmlFor="reservationDate" className="block text-sm font-medium">
              利用日
            </label>
            <select
              id="reservationDate"
              name="reservationDate"
              required
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {availableDates.map((date) => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="slotId" className="block text-sm font-medium">
              空き枠
            </label>
            {loading ? (
              <p className="mt-2 text-sm text-muted">空き枠を更新中...</p>
            ) : slotsForDate.length === 0 ? (
              <p className="mt-2 text-sm text-muted">この日は空き枠がありません</p>
            ) : (
              <select
                id="slotId"
                name="slotId"
                required
                value={selectedSlotId}
                onChange={(e) => handleSlotChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">時間帯を選択してください</option>
                {slotsForDate.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {formatTime(slot.start_time)} 〜 {formatTime(slot.end_time)}
                    （残り {slot.remaining_count} 名）
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="guestCount" className="block text-sm font-medium">
              参加人数
            </label>
            <select
              id="guestCount"
              name="guestCount"
              required
              value={guestCount}
              disabled={!selectedSlotId || loading}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              className={cn(
                "mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary",
                !selectedSlotId && "cursor-not-allowed opacity-50",
              )}
            >
              {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} 名
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold">お支払い方法</h2>
        <PaymentMethodSelector
          value={paymentMethod}
          onChange={setPaymentMethod}
          disabled={pending || loading}
        />
        {paymentMethod && (
          <input type="hidden" name="paymentMethod" value={paymentMethod} />
        )}
      </Card>

      <Card className="bg-sky-50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted">合計金額</span>
          <span className="text-2xl font-bold text-primary">
            {formatYen(totalAmount)}
          </span>
        </div>
      </Card>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={
          pending ||
          loading ||
          !selectedSlotId ||
          !paymentMethod ||
          slotsForDate.length === 0
        }
      >
        {pending ? "予約処理中..." : "予約する"}
      </Button>

      <Link
        href={`/spots/${spot.slug}`}
        className="block text-center text-sm text-muted hover:text-primary"
      >
        釣り場詳細に戻る
      </Link>
    </form>
  );
}

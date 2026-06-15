"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cancelReservationAction } from "@/actions/reservation";
import { Button } from "@/components/ui/Button";
import { cancelReservationInitialState } from "@/types/reservation-action";

interface CancelReservationButtonProps {
  reservationId: string;
}

export function CancelReservationButton({ reservationId }: CancelReservationButtonProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    cancelReservationAction,
    cancelReservationInitialState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="reservationId" value={reservationId} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending}
          className="border-red-200 text-red-700 hover:bg-red-50"
        >
          {pending ? "キャンセル中..." : "予約をキャンセル"}
        </Button>
      </form>
      {state.error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-2 text-xs text-green-700" role="status">
          予約をキャンセルしました。
        </p>
      )}
    </div>
  );
}

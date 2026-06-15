"use client";

import { useActionState } from "react";
import { adminCancelReservationAction } from "@/app/(admin)/admin/reservations/actions";
import { Button } from "@/components/ui/Button";
import { adminCancelReservationInitialState } from "@/types/reservation-action";

interface AdminCancelReservationButtonProps {
  reservationId: string;
}

export function AdminCancelReservationButton({
  reservationId,
}: AdminCancelReservationButtonProps) {
  const [state, formAction, pending] = useActionState(
    adminCancelReservationAction,
    adminCancelReservationInitialState,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      "この予約をキャンセルしますか？\n空き枠が解放され、元に戻せません。",
    );
    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <div>
      <form action={formAction} onSubmit={handleSubmit}>
        <input type="hidden" name="reservationId" value={reservationId} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending}
          className="border-red-200 text-red-700 hover:bg-red-50"
        >
          {pending ? "処理中..." : "キャンセル"}
        </Button>
      </form>
      {state.error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
